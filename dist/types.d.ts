export type TokenType = "KEYWORD" | "IDENTIFIER" | "PLOT_FUNCTION" | "LPAREN" | "RPAREN" | "COMMA" | "STRING" | "NUMBER" | "NULL" | "COMPARISON_OPERATOR" | "LOGICAL_OPERATOR" | "AGGREGATION_FUNCTION" | "EOF";
export type PlotFunction = "BAR" | "LINE" | "SCATTER";
export type AggregationFunction = "MIN" | "MAX" | "AVG" | "SUM" | "COUNT";
export type Token = {
    type: TokenType;
    value: string;
};
export type SPLQuery = {
    plotClause?: PlotClause;
    selectColumns: ColumnMetadata[];
    whereCondition?: WhereCondition;
    groupKey?: string;
    limitAndOffset?: LimitAndOffset;
};
export interface PlotClause {
    plotFunction: PlotFunction;
}
export interface BarPlotCall extends PlotClause {
    plotFunction: "BAR";
    categoriesIdentifier: string;
    valuesIdentifier: string;
}
export interface PointPlotCall extends PlotClause {
    plotFunction: "LINE" | "SCATTER";
    xIdentifier: string;
    yIdentifier: string;
}
export type PlotFunctionArg = {
    argName: string;
    columnIdentifier: string;
};
export type ColumnMetadata = {
    identifier: string;
    column?: string;
    aggregationFunction?: AggregationFunction;
};
export type WhereCondition = AndCondition | OrCondition | GreaterThanCondition | GreaterThanOrEqualCondition | LessThanCondition | LessThanOrEqualCondition | EqualCondition | NotEqualCondition;
export type AndCondition = {
    and: WhereCondition[];
};
export type OrCondition = {
    or: WhereCondition[];
};
export type GreaterThanCondition = {
    gt: CompareKeyAndValue<number>;
};
export type GreaterThanOrEqualCondition = {
    gte: CompareKeyAndValue<number>;
};
export type LessThanCondition = {
    lt: CompareKeyAndValue<number>;
};
export type LessThanOrEqualCondition = {
    lte: CompareKeyAndValue<number>;
};
export type EqualCondition = {
    eq: CompareKeyAndValue<any>;
};
export type NotEqualCondition = {
    neq: CompareKeyAndValue<any>;
};
export type CompareKeyAndValue<T> = {
    key: string;
    value: T;
};
export type LimitAndOffset = {
    limit: number;
    offset: number;
};
