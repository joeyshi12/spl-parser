import { SPLQuery } from './types';
import { Lexer } from './lexer';
/**
 * Parser for SPL queries
 */
export declare class Parser {
    private _lexer;
    private _currentToken;
    constructor(lexer: Lexer);
    /**
     * Parses the SPL query into a syntax tree
     * @returns AST of the SPL query
     */
    parse(): SPLQuery;
    private _consumePlotClauseOptional;
    private _consumePlotArgs;
    private _consumeSelectClause;
    private _consumeColumn;
    private _consumeWhereClauseOptional;
    private _consumeCondition;
    private _consumeConditionGroup;
    private _consumeComparison;
    private _consumeGroupByClauseOptional;
    private _consumeLimitAndOffsetClauseOptional;
    private _consumeToken;
    private _consumeComparisonValue;
}
