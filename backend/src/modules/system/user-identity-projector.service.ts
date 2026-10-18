import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { User } from "../../entities/user.entity";

export interface SafeUserIdentity {
  id: number;
  fullName: string;
  email: string;
}

@Injectable()
export class UserIdentityProjectorService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Batch projects distinct user IDs into safe public identities.
   * Performs exactly 1 query with In(cleanIds).
   * Safe for null/undefined/0/NaN/duplicate IDs.
   * Never selects passwordHash, refreshToken, or sensitive auth fields.
   */
  async projectUsers(
    userIds: (number | string | null | undefined)[],
  ): Promise<Map<number, SafeUserIdentity>> {
    const result = new Map<number, SafeUserIdentity>();
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return result;
    }

    const cleanIds = Array.from(
      new Set(
        userIds
          .map((id) => Number(id))
          .filter((id) => !isNaN(id) && id > 0 && Number.isInteger(id)),
      ),
    );

    if (cleanIds.length === 0) {
      return result;
    }

    const users = await this.userRepo.find({
      where: { id: In(cleanIds) },
      select: ["id", "fullName", "email"],
    });

    for (const u of users) {
      result.set(Number(u.id), {
        id: Number(u.id),
        fullName: u.fullName || `User #${u.id}`,
        email: u.email || "",
      });
    }

    return result;
  }

  /**
   * Single user helper. Returns safe identity or null.
   */
  async projectUser(
    userId: number | string | null | undefined,
  ): Promise<SafeUserIdentity | null> {
    if (!userId) return null;
    const numId = Number(userId);
    if (isNaN(numId) || numId <= 0) return null;
    const map = await this.projectUsers([numId]);
    return map.get(numId) || null;
  }
}
