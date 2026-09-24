import { BadRequestException } from '@nestjs/common';

export class ConditionEvaluator {
  /**
   * Evaluates a safe expression against the provided context.
   * Whitelisted operators: ==, !=, >, >=, <, <=, AND, OR, IN
   * No eval() or arbitrary code execution.
   */
  static evaluate(expression: string, context: Record<string, any>): boolean {
    if (!expression || typeof expression !== 'string' || expression.trim() === '') {
      throw new BadRequestException('Condition expression cannot be empty.');
    }

    const trimmed = expression.trim();

    // Check for OR clauses
    const orParts = this.splitLogical(trimmed, 'OR');
    if (orParts.length > 1) {
      return orParts.some((part) => this.evaluate(part, context));
    }

    // Check for AND clauses
    const andParts = this.splitLogical(trimmed, 'AND');
    if (andParts.length > 1) {
      return andParts.every((part) => this.evaluate(part, context));
    }

    // Single comparison clause
    return this.evaluateComparison(trimmed, context);
  }

  private static splitLogical(expr: string, operator: 'AND' | 'OR'): string[] {
    const regex = new RegExp(`\\s+${operator}\\s+`, 'i');
    return expr.split(regex).map((p) => p.trim());
  }

  private static evaluateComparison(clause: string, context: Record<string, any>): boolean {
    // Supported operators in precedence order (multi-char first)
    const operators = ['>=', '<=', '!=', '==', '>', '<', ' IN ', ' in '];
    let matchedOp: string | null = null;

    for (const op of operators) {
      if (clause.includes(op)) {
        matchedOp = op;
        break;
      }
    }

    if (!matchedOp) {
      throw new BadRequestException(
        `Invalid condition clause: '${clause}'. Must contain one of: ==, !=, >, >=, <, <=, IN`,
      );
    }

    const parts = clause.split(matchedOp);
    if (parts.length !== 2) {
      throw new BadRequestException(`Malformed comparison: '${clause}'`);
    }

    const leftKey = parts[0].trim();
    const rightValRaw = parts[1].trim();

    const actualVal = this.resolveValue(leftKey, context);
    const expectedVal = this.parseLiteral(rightValRaw, context);

    const opTrimmed = matchedOp.trim().toUpperCase();

    switch (opTrimmed) {
      case '==':
        return actualVal == expectedVal; // standard loose equal for numbers as strings or actual values
      case '!=':
        return actualVal != expectedVal;
      case '>':
        return Number(actualVal) > Number(expectedVal);
      case '>=':
        return Number(actualVal) >= Number(expectedVal);
      case '<':
        return Number(actualVal) < Number(expectedVal);
      case '<=':
        return Number(actualVal) <= Number(expectedVal);
      case 'IN': {
        let list: any[];
        if (Array.isArray(expectedVal)) {
          list = expectedVal;
        } else if (typeof expectedVal === 'string') {
          list = expectedVal.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          list = [expectedVal];
        }
        return list.some((item) => item == actualVal);
      }
      default:
        throw new BadRequestException(`Unsupported operator: '${matchedOp}'`);
    }
  }

  private static resolveValue(path: string, context: Record<string, any>): any {
    // Strip quotes if any
    const cleanPath = path.replace(/^['"]|['"]$/g, '');
    if (!context || typeof context !== 'object') {
      return undefined;
    }

    const segments = cleanPath.split('.');
    let curr: any = context;
    for (const seg of segments) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[seg];
    }
    return curr;
  }

  private static parseLiteral(raw: string, context: Record<string, any>): any {
    // Array literal: [a, b, c] or (a, b, c)
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('(') && raw.endsWith(')'))) {
      const inner = raw.substring(1, raw.length - 1);
      return inner.split(',').map((item) => this.parseLiteral(item.trim(), context));
    }

    // Quoted string: "hello" or 'hello'
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      return raw.substring(1, raw.length - 1);
    }

    // Number
    if (!isNaN(Number(raw))) {
      return Number(raw);
    }

    // Boolean
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    if (raw.toLowerCase() === 'null') return null;

    // Fallback: check if it references a context variable
    if (context && context[raw] !== undefined) {
      return context[raw];
    }

    return raw;
  }
}
