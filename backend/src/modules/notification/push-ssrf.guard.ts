import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import * as net from 'net';

export class PushSsrfException extends Error {
  public readonly code = 'SSRF_REJECTED';
  public readonly layer: number;

  constructor(layer: number, message: string) {
    super(`SSRF_REJECTED [Layer ${layer}]: ${message}`);
    this.name = 'PushSsrfException';
    this.layer = layer;
  }
}

export interface DnsResolvedRecord {
  address: string;
  family: number;
}

export type DnsLookupFunction = (
  hostname: string,
) => Promise<DnsResolvedRecord[]>;

export interface ValidatedPushTarget {
  url: URL;
  hostname: string;
  pinnedAddress: string;
  family: 4 | 6;
}

/**
 * 8-Layer SSRF Guard for Web Push Endpoints
 * Reference:
 * - docs/audit/EPMS_WEB_PUSH_PRE_IMPLEMENTATION_READINESS.md §6.1
 * - docs/audit/EPMS_WEB_PUSH_MYSQL_OUTBOX_FINAL_TECHNICAL_DESIGN.md §9.2
 */
@Injectable()
export class PushSsrfGuard {
  // Exact allowlisted hostnames (Google FCM & Mozilla Autopush)
  private static readonly EXACT_HOSTNAMES = new Set<string>([
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
  ]);

  // Strict Subdomain Regexes (Apple APNs & Microsoft WNS)
  // Exactly 70 chars (3 escaped dots) for Apple APNs:
  public static readonly APPLE_APNS_REGEX = new RegExp(
    '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+push\\.apple\\.com$',
  );

  // Exactly 96 chars (5 escaped dots) for Microsoft WNS:
  public static readonly MICROSOFT_WNS_REGEX = new RegExp(
    '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+(?:notify\\.windows\\.com|wns\\.windows\\.com)$',
  );

  private dnsLookup: DnsLookupFunction;

  // RFC 6052 Well-Known NAT64 /96 Prefix (64:ff9b::/96) — static standard prefix
  private static readonly WELL_KNOWN_NAT64_PREFIX =
    0x0064ff9b000000000000000000000000n;

  // Dynamically discovered NAT64 /96 prefixes mapped to their expiration timestamp (epoch ms)
  private readonly dynamicNat64PrefixExpiry = new Map<bigint, number>();
  private nat64LastDiscoveredAt = 0;
  private nat64DiscoveryInFlight: Promise<Set<bigint>> | null = null;
  private readonly NAT64_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.dnsLookup = async (hostname: string) => {
      return dns.promises.lookup(hostname, { all: true, verbatim: true });
    };
  }

  /**
   * Allows overriding the DNS lookup function in unit/integration tests.
   */
  public setDnsLookup(fn: DnsLookupFunction): void {
    this.dnsLookup = fn;
  }

  /**
   * Evicts any dynamically discovered NAT64 prefixes whose TTL has expired.
   */
  private evictExpiredNat64Prefixes(now: number = Date.now()): void {
    for (const [prefix, expiresAt] of this.dynamicNat64PrefixExpiry.entries()) {
      if (expiresAt <= now) {
        this.dynamicNat64PrefixExpiry.delete(prefix);
      }
    }
  }

  /**
   * Registers or refreshes a dynamic NAT64 /96 prefix with a bounded expiration timestamp.
   */
  private registerDynamicNat64Prefix(prefixVal: bigint, expiresAt: number): void {
    const masked = prefixVal & (~0xffffffffn);
    if (masked === PushSsrfGuard.WELL_KNOWN_NAT64_PREFIX) {
      return;
    }
    const existingExpiry = this.dynamicNat64PrefixExpiry.get(masked) ?? 0;
    if (expiresAt > existingExpiry) {
      this.dynamicNat64PrefixExpiry.set(masked, expiresAt);
    }
  }

  /**
   * Returns the set of currently valid (non-expired) NAT64 /96 prefixes.
   */
  private getActiveNat64Prefixes(now: number = Date.now()): Set<bigint> {
    this.evictExpiredNat64Prefixes(now);
    const active = new Set<bigint>([PushSsrfGuard.WELL_KNOWN_NAT64_PREFIX]);
    for (const prefix of this.dynamicNat64PrefixExpiry.keys()) {
      active.add(prefix);
    }
    return active;
  }

  /**
   * Allows manually specifying or overriding verified NAT64 /96 prefixes in tests.
   */
  public setDiscoveredNat64Prefixes(
    prefixes: string[],
    ttlMs: number = this.NAT64_CACHE_TTL_MS,
  ): void {
    const now = Date.now();
    this.dynamicNat64PrefixExpiry.clear();
    const expiresAt = now + Math.max(0, ttlMs);
    for (const p of prefixes) {
      const val = PushSsrfGuard.parseIpv6ToBigInt(p);
      if (val !== null) {
        const masked = val & (~0xffffffffn);
        if (masked !== PushSsrfGuard.WELL_KNOWN_NAT64_PREFIX) {
          this.dynamicNat64PrefixExpiry.set(masked, expiresAt);
        }
      }
    }
    this.nat64LastDiscoveredAt = now;
  }

  /**
   * Returns a copy of currently active (non-expired) NAT64 prefixes (for unit testing and diagnostics).
   */
  public getDiscoveredNat64Prefixes(): Set<bigint> {
    return this.getActiveNat64Prefixes(Date.now());
  }

  /**
   * Resets discovered NAT64 prefixes to default well-known prefix (for unit testing).
   */
  public clearDiscoveredNat64Prefixes(): void {
    this.dynamicNat64PrefixExpiry.clear();
    this.nat64LastDiscoveredAt = 0;
    this.nat64DiscoveryInFlight = null;
  }

  /**
   * RFC 7050 DNS64/NAT64 Prefix Discovery via ipv4only.arpa.
   * Discovers network-specific IPv6 translation prefixes (e.g. fd00:aa:bb:2090::/96)
   * used by local ISP/carrier NAT64 gateways, enforcing per-prefix TTL eviction and
   * single-flight concurrency deduplication.
   */
  public async discoverNat64Prefixes(): Promise<Set<bigint>> {
    const now = Date.now();
    this.evictExpiredNat64Prefixes(now);

    if (
      this.nat64LastDiscoveredAt > 0 &&
      now - this.nat64LastDiscoveredAt < this.NAT64_CACHE_TTL_MS
    ) {
      return this.getActiveNat64Prefixes(now);
    }

    if (this.nat64DiscoveryInFlight) {
      return this.nat64DiscoveryInFlight;
    }

    this.nat64DiscoveryInFlight = (async () => {
      let foundNew = false;
      try {
        const records = await this.dnsLookup('ipv4only.arpa');
        const completedAt = Date.now();
        this.evictExpiredNat64Prefixes(completedAt);

        if (Array.isArray(records)) {
          for (const rec of records) {
            if (rec.family === 6 && rec.address) {
              const val = PushSsrfGuard.parseIpv6ToBigInt(rec.address);
              if (val === null) continue;

              // Lower 32 bits of synthesized AAAA record for ipv4only.arpa must be:
              // 192.0.0.170 (0xc00000aa) or 192.0.0.171 (0xc00000ab) per RFC 7050 §2.1
              const lower32 = Number(val & 0xffffffffn) >>> 0;
              if (lower32 === 0xc00000aa || lower32 === 0xc00000ab) {
                const prefixVal = val & (~0xffffffffn);
                this.registerDynamicNat64Prefix(
                  prefixVal,
                  completedAt + this.NAT64_CACHE_TTL_MS,
                );
                foundNew = true;
              }
            }
          }
        }
      } catch {
        // If RFC 7050 discovery fails (e.g. offline/mocked DNS), keep currently non-expired prefixes
      } finally {
        const finishedAt = Date.now();
        // If discovery succeeded, cache poll for 5 min; if not, retry sooner (10 seconds)
        this.nat64LastDiscoveredAt = foundNew
          ? finishedAt
          : Math.max(0, finishedAt - this.NAT64_CACHE_TTL_MS + 10000);
        this.nat64DiscoveryInFlight = null;
      }

      return this.getActiveNat64Prefixes(Date.now());
    })();

    return this.nat64DiscoveryInFlight;
  }

  /**
   * Extracts the embedded IPv4 address from the lower 32 bits of an IPv6 address (RFC 6052 / RFC 7050).
   */
  public static extractEmbeddedIpv4(ipv6: string): string | null {
    const ipVal = PushSsrfGuard.parseIpv6ToBigInt(ipv6);
    if (ipVal === null) return null;
    const lower32 = Number(ipVal & 0xffffffffn) >>> 0;
    const o1 = (lower32 >>> 24) & 0xff;
    const o2 = (lower32 >>> 16) & 0xff;
    const o3 = (lower32 >>> 8) & 0xff;
    const o4 = lower32 & 0xff;
    return `${o1}.${o2}.${o3}.${o4}`;
  }

  /**
   * Evaluates if an IPv6 address falls within a verified NAT64 /96 prefix,
   * and if so, extracts the embedded IPv4 address.
   */
  public static isNat64Address(
    ipv6: string,
    prefixes: Set<bigint>,
  ): { isNat64: boolean; embeddedV4?: string } {
    const ipVal = PushSsrfGuard.parseIpv6ToBigInt(ipv6);
    if (ipVal === null) return { isNat64: false };

    const targetPrefix = ipVal & (~0xffffffffn);
    if (prefixes.has(targetPrefix)) {
      const embeddedV4 = PushSsrfGuard.extractEmbeddedIpv4(ipv6);
      return { isNat64: true, embeddedV4: embeddedV4 || undefined };
    }

    return { isNat64: false };
  }

  /**
   * Validates Layers 1 through 4 (URL parsing, HTTPS protocol, standard port 443,
   * no userinfo credentials, and strict vendor hostname allowlist).
   */
  public validateEndpointUrlSyntax(endpoint: string): URL {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new PushSsrfException(1, 'Endpoint must be a non-empty string');
    }

    const trimmed = endpoint.trim();
    if (trimmed.length === 0 || trimmed.length > 2048) {
      throw new PushSsrfException(1, 'Endpoint length is invalid');
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new PushSsrfException(1, 'Malformed URL syntax');
    }

    // Layer 1: Protocol scheme must be strictly https:
    if (parsed.protocol !== 'https:') {
      throw new PushSsrfException(
        1,
        `Forbidden protocol scheme "${parsed.protocol}"; only "https:" is permitted`,
      );
    }

    // Layer 2: Port must be empty (default 443) or explicitly '443'
    // Note: URL parser normalizes default port :443 on https: to '', so check raw authority too
    const authorityMatch = /^https:\/\/([^/?#]+)/i.exec(trimmed);
    if (!authorityMatch) {
      throw new PushSsrfException(1, 'Missing URL authority');
    }
    const rawAuthority = authorityMatch[1];

    // Layer 3: Reject credentials / userinfo in authority
    if (parsed.username || parsed.password || rawAuthority.includes('@')) {
      throw new PushSsrfException(
        3,
        'Userinfo credentials are forbidden in push endpoint URL',
      );
    }

    // Check explicit port in rawAuthority
    const portSeparatorIdx = rawAuthority.lastIndexOf(':');
    if (portSeparatorIdx !== -1 && !rawAuthority.endsWith(']')) {
      const explicitPort = rawAuthority.slice(portSeparatorIdx + 1);
      if (explicitPort !== '443') {
        throw new PushSsrfException(
          2,
          `Non-standard port ":${explicitPort}" is forbidden`,
        );
      }
    }
    if (parsed.port !== '' && parsed.port !== '443') {
      throw new PushSsrfException(
        2,
        `Non-standard port ":${parsed.port}" is forbidden`,
      );
    }

    // Layer 4: Strict Hostname Allowlist Matching
    const hostname = parsed.hostname.toLowerCase();
    if (!PushSsrfGuard.isAllowedHostname(hostname)) {
      throw new PushSsrfException(
        4,
        `Hostname "${hostname}" is not in the authorized Web Push vendor allowlist`,
      );
    }

    return parsed;
  }

  /**
   * Layer 4 static hostname allowlist matcher.
   */
  public static isAllowedHostname(hostname: string): boolean {
    if (!hostname || hostname.length > 253) {
      return false;
    }

    // Reject IP literals directly
    if (net.isIP(hostname) !== 0 || hostname.startsWith('[')) {
      return false;
    }

    const normalized = hostname.toLowerCase();
    if (PushSsrfGuard.EXACT_HOSTNAMES.has(normalized)) {
      return true;
    }

    if (PushSsrfGuard.APPLE_APNS_REGEX.test(normalized)) {
      return true;
    }

    if (PushSsrfGuard.MICROSOFT_WNS_REGEX.test(normalized)) {
      return true;
    }

    return false;
  }

  /**
   * Layer 6: Evaluates whether an IPv4 or IPv6 address is a globally routable
   * public unicast IP (rejecting all RFC 6890 / IANA special-purpose ranges,
   * including IPv4-mapped IPv6 addresses).
   * Supports optional verified NAT64 /96 prefixes (RFC 7050 / RFC 6052).
   */
  public static isPublicGlobalIp(ip: string, allowedNat64Prefixes?: Set<bigint>): boolean {
    if (!ip || typeof ip !== 'string') {
      return false;
    }

    const trimmed = ip.trim().replace(/^\[|\]$/g, '');

    // Reject IPv6 zone indices (e.g. fe80::1%eth0)
    if (trimmed.includes('%')) {
      return false;
    }

    const version = net.isIP(trimmed);
    if (version === 4) {
      return PushSsrfGuard.isPublicIpv4(trimmed);
    }
    if (version === 6) {
      return PushSsrfGuard.isPublicIpv6(trimmed, allowedNat64Prefixes);
    }
    return false;
  }

  /**
   * Layer 6 assertion helper: throws PushSsrfException(6, ...) if IP is not public.
   */
  public assertPublicIp(ip: string, activePrefixes?: Set<bigint>): void {
    const prefixes = activePrefixes ?? this.getActiveNat64Prefixes(Date.now());
    if (!PushSsrfGuard.isPublicGlobalIp(ip, prefixes)) {
      throw new PushSsrfException(
        6,
        `Resolved IP address "${ip}" falls within a restricted/non-public RFC 6890 range`,
      );
    }
  }

  /**
   * Executes Layers 1–4 (URL & Hostname validation) + Layer 6 (DNS resolution
   * of all A/AAAA records & RFC 6890 filtering) and returns pinned target info
   * for Layer 7 (Socket IP pinning with TLS SNI preservation).
   */
  public async resolveAndValidateEndpoint(
    endpoint: string,
  ): Promise<ValidatedPushTarget> {
    const parsedUrl = this.validateEndpointUrlSyntax(endpoint);

    // Refresh RFC 7050 DNS64 prefix discovery if needed (also evicts expired prefixes)
    await this.discoverNat64Prefixes();

    let records: DnsResolvedRecord[];
    try {
      records = await this.dnsLookup(parsedUrl.hostname);
    } catch (err: any) {
      throw new PushSsrfException(
        6,
        `DNS resolution failed for "${parsedUrl.hostname}": ${err?.code || err?.message || 'DNS_ERROR'}`,
      );
    }

    if (!records || records.length === 0) {
      throw new PushSsrfException(
        6,
        `DNS resolution returned 0 records for "${parsedUrl.hostname}"`,
      );
    }

    // Step A: Collect all valid public IPv4 addresses resolved for this allowlisted vendor hostname
    const validPublicV4s = new Set<string>();
    for (const rec of records) {
      if (rec.family === 4 && PushSsrfGuard.isPublicIpv4(rec.address)) {
        validPublicV4s.add(rec.address);
      }
    }

    // Step B: DNS64/NAT64 A/AAAA Cross-Correlation Verification:
    // If the cellular resolver synthesized IPv6 ULA (fc00::/7) records for this allowlisted domain,
    // verify whether its lower 32 bits exactly match one of the verified public IPv4 A records
    // returned in the same DNS response. If matched, its /96 prefix is verified as legitimate
    // NAT64 translation on the local network and registered with a bounded TTL.
    const correlationNow = Date.now();
    this.evictExpiredNat64Prefixes(correlationNow);
    if (validPublicV4s.size > 0) {
      for (const rec of records) {
        if (rec.family === 6 && rec.address) {
          const val = PushSsrfGuard.parseIpv6ToBigInt(rec.address);
          if (val !== null && PushSsrfGuard.inCidrV6(val, 'fc00::', 7)) {
            const embeddedV4 = PushSsrfGuard.extractEmbeddedIpv4(rec.address);
            if (embeddedV4 && validPublicV4s.has(embeddedV4)) {
              const prefixVal = val & (~0xffffffffn);
              this.registerDynamicNat64Prefix(
                prefixVal,
                correlationNow + this.NAT64_CACHE_TTL_MS,
              );
            }
          }
        }
      }
    }

    // Snapshot active (non-expired) prefixes for consistent validation & selection in this request
    const activePrefixes = this.getActiveNat64Prefixes(correlationNow);

    // Step C: Layer 6 Defense-in-Depth: Validate EVERY single resolved record.
    // If ANY record is loopback, link-local, private IPv4, or an unverified/expired ULA,
    // immediately reject the entire endpoint (DNS rebinding defense).
    for (const rec of records) {
      this.assertPublicIp(rec.address, activePrefixes);
    }

    // Step D: Address selection & socket pinning:
    // When both public IPv4 and synthesized IPv6 records exist (e.g. mobile tethering),
    // strictly prioritize native public IPv4 for socket connection to guarantee reliable transport,
    // then native public IPv6, then NAT64-translated address.
    const publicV4 = records.find(
      (r) => r.family === 4 && PushSsrfGuard.isPublicIpv4(r.address),
    );
    const nativeV6 = records.find(
      (r) =>
        r.family === 6 &&
        PushSsrfGuard.isPublicGlobalIp(r.address) &&
        !PushSsrfGuard.isNat64Address(r.address, activePrefixes).isNat64,
    );
    const translatedV6 = records.find(
      (r) =>
        r.family === 6 &&
        PushSsrfGuard.isPublicGlobalIp(r.address, activePrefixes),
    );

    const primary = publicV4 || nativeV6 || translatedV6 || records[0];
    const family: 4 | 6 = net.isIP(primary.address) === 6 ? 6 : 4;

    return {
      url: parsedUrl,
      hostname: parsedUrl.hostname,
      pinnedAddress: primary.address,
      family,
    };
  }

  private static parseIpv4ToUint32(ipv4: string): number | null {
    const parts = ipv4.split('.');
    if (parts.length !== 4) return null;
    let result = 0;
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return null;
      const octet = Number(part);
      if (octet < 0 || octet > 255) return null;
      result = ((result << 8) | octet) >>> 0;
    }
    return result >>> 0;
  }

  private static inCidrV4(ipNum: number, baseIp: string, prefixLen: number): boolean {
    const baseNum = PushSsrfGuard.parseIpv4ToUint32(baseIp);
    if (baseNum === null) return false;
    const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
    return (ipNum & mask) >>> 0 === (baseNum & mask) >>> 0;
  }

  private static isPublicIpv4(ipv4: string): boolean {
    const ipNum = PushSsrfGuard.parseIpv4ToUint32(ipv4);
    if (ipNum === null) return false;

    const blockedRanges: Array<[string, number]> = [
      ['0.0.0.0', 8],          // "This" network (RFC 1122)
      ['10.0.0.0', 8],         // Private-Use (RFC 1918)
      ['100.64.0.0', 10],      // Shared Address Space / CGNAT (RFC 6598)
      ['127.0.0.0', 8],        // Loopback (RFC 1122)
      ['169.254.0.0', 16],     // Link-Local / Cloud Metadata 169.254.169.254 (RFC 3927)
      ['172.16.0.0', 12],      // Private-Use (RFC 1918)
      ['192.0.0.0', 24],       // IETF Protocol Assignments (RFC 6890)
      ['192.0.2.0', 24],       // Documentation TEST-NET-1 (RFC 5737)
      ['192.88.99.0', 24],     // 6to4 Relay Anycast (RFC 7526)
      ['192.168.0.0', 16],     // Private-Use (RFC 1918)
      ['198.18.0.0', 15],      // Benchmarking (RFC 2544)
      ['198.51.100.0', 24],    // Documentation TEST-NET-2 (RFC 5737)
      ['203.0.113.0', 24],     // Documentation TEST-NET-3 (RFC 5737)
      ['224.0.0.0', 4],        // Multicast (RFC 5771)
      ['240.0.0.0', 4],        // Reserved for Future Use (RFC 1112)
      ['255.255.255.255', 32], // Limited Broadcast (RFC 919)
    ];

    for (const [base, prefix] of blockedRanges) {
      if (PushSsrfGuard.inCidrV4(ipNum, base, prefix)) {
        return false;
      }
    }

    return true;
  }

  private static parseIpv6ToBigInt(ipv6: string): bigint | null {
    let normalized = ipv6.toLowerCase();

    // Handle embedded dotted-quad IPv4 at the end of IPv6 (e.g. ::ffff:127.0.0.1)
    const lastColon = normalized.lastIndexOf(':');
    if (lastColon !== -1 && normalized.slice(lastColon + 1).includes('.')) {
      const ipv4Part = normalized.slice(lastColon + 1);
      const v4Num = PushSsrfGuard.parseIpv4ToUint32(ipv4Part);
      if (v4Num === null) return null;
      const highHex = ((v4Num >>> 16) & 0xffff).toString(16);
      const lowHex = (v4Num & 0xffff).toString(16);
      normalized = `${normalized.slice(0, lastColon)}:${highHex}:${lowHex}`;
    }

    const doubleColonParts = normalized.split('::');
    if (doubleColonParts.length > 2) return null;

    let groups: string[];
    if (doubleColonParts.length === 2) {
      const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
      const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
      const missing = 8 - (left.length + right.length);
      if (missing < 1) return null;
      groups = [...left, ...Array(missing).fill('0'), ...right];
    } else {
      groups = normalized.split(':');
      if (groups.length !== 8) return null;
    }

    if (groups.length !== 8) return null;

    let value = 0n;
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      value = (value << 16n) | BigInt(parseInt(g, 16));
    }
    return value;
  }

  private static inCidrV6(ipVal: bigint, baseIpv6: string, prefixLen: number): boolean {
    const baseVal = PushSsrfGuard.parseIpv6ToBigInt(baseIpv6);
    if (baseVal === null) return false;
    if (prefixLen === 0) return true;
    const shift = BigInt(128 - prefixLen);
    return (ipVal >> shift) === (baseVal >> shift);
  }

  private static isPublicIpv6(ipv6: string, allowedNat64Prefixes?: Set<bigint>): boolean {
    const ipVal = PushSsrfGuard.parseIpv6ToBigInt(ipv6);
    if (ipVal === null) return false;

    // 1. Unspecified ::/128 and Loopback ::1/128
    if (ipVal === 0n || ipVal === 1n) {
      return false;
    }

    // 2. IPv4-Mapped IPv6 (::ffff:0:0/96):
    // Unmap lower 32 bits and validate against IPv4 rules; also reject if mapped IPv4 is non-public
    if (PushSsrfGuard.inCidrV6(ipVal, '::ffff:0:0', 96)) {
      const v4Num = Number(ipVal & 0xffffffffn) >>> 0;
      const o1 = (v4Num >>> 24) & 0xff;
      const o2 = (v4Num >>> 16) & 0xff;
      const o3 = (v4Num >>> 8) & 0xff;
      const o4 = v4Num & 0xff;
      const unmappedV4 = `${o1}.${o2}.${o3}.${o4}`;
      if (!PushSsrfGuard.isPublicIpv4(unmappedV4)) {
        return false;
      }
      return false;
    }

    // 3. DNS64 / NAT64 Translated Address check (RFC 7050 / RFC 6052):
    // If the address falls under a discovered / verified /96 NAT64 prefix (or standard 64:ff9b::/96),
    // validate that the embedded IPv4 address is a public, globally routable IPv4 address.
    if (allowedNat64Prefixes && allowedNat64Prefixes.size > 0) {
      const nat64 = PushSsrfGuard.isNat64Address(ipv6, allowedNat64Prefixes);
      if (nat64.isNat64 && nat64.embeddedV4) {
        return PushSsrfGuard.isPublicIpv4(nat64.embeddedV4);
      }
    }

    // 4. Special-purpose IPv6 blocks per RFC 6890 / IANA
    const blockedV6Ranges: Array<[string, number]> = [
      ['::', 96],            // IPv4-compatible IPv6 (deprecated RFC 4291)
      ['64:ff9b::', 96],     // Well-Known NAT64 Prefix (handled above if valid, otherwise blocked)
      ['64:ff9b:1::', 48],   // Local-Use IPv4/IPv6 Translation (RFC 8215)
      ['100::', 64],         // Discard-Only Address Block (RFC 6666)
      ['2001::', 23],        // IETF Protocol Assignments (RFC 2928) incl. Teredo 2001::/32
      ['2001:db8::', 32],    // Documentation (RFC 3849)
      ['2002::', 16],        // 6to4 (RFC 3056)
      ['fc00::', 7],         // Unique Local Address - ULA (RFC 4193)
      ['fe80::', 10],        // Link-Local Unicast (RFC 4291)
      ['ff00::', 8],         // Multicast (RFC 4291)
    ];

    for (const [base, prefix] of blockedV6Ranges) {
      if (PushSsrfGuard.inCidrV6(ipVal, base, prefix)) {
        return false;
      }
    }

    return true;
  }
}

