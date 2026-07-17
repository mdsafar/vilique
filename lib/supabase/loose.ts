type QueryResult = {
    data: unknown;
    count?: number | null;
    error: {
        code?: string;
        message: string;
        details?: string;
        hint?: string;
    } | null;
};

type LooseQuery = PromiseLike<QueryResult> & {
    select: (columns?: string, options?: unknown) => LooseQuery;
    insert: (values: unknown) => LooseQuery;
    update: (values: unknown) => LooseQuery;
    eq: (column: string, value: unknown) => LooseQuery;
    neq: (column: string, value: unknown) => LooseQuery;
    in: (column: string, values: unknown[]) => LooseQuery;
    or: (filters: string) => LooseQuery;
    gt: (column: string, value: unknown) => LooseQuery;
    lte: (column: string, value: unknown) => LooseQuery;
    order: (column: string, options?: unknown) => LooseQuery;
    limit: (count: number) => LooseQuery;
    single: () => LooseQuery;
    maybeSingle: () => LooseQuery;
};

type LooseSupabase = {
    from: (relation: string) => LooseQuery;
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<QueryResult>;
};

export function looseSupabase(client: unknown) {
    return client as LooseSupabase;
}
