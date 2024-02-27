/**
 * @deprecated
 *
 * use Options replaced
 */
export type IIndexDb = {
	/**
	 * @deprecated
	 *
	 * use name replaced
	 */
	dbName: string;
	/**
	 * next release version will be required
	 *
	 * dbName will be remove in next release version
	 */
	name?: string;
	version: number;
	tables: DBTable[];
};

export type Options = {
	name: string;
	version: number;
	tables: DBTable[];
};
/**
 * @deprecated
 *
 * use DBIndex replaced
 */
export type DbIndex = { key: string; option?: IDBIndexParameters };

export type DBIndex = { key: string; option?: IDBIndexParameters };
/**
 * @deprecated
 *
 * use DbTable replaced
 */
export type DbTable = {
	tableName: string;
	option?: IDBObjectStoreParameters;
	indexs: DbIndex[];
};

export type DBTable = {
	/**
	 * @deprecated
	 *
	 * use name replaced
	 */
	tableName: string;
    name: string
	option?: IDBObjectStoreParameters;
	/**
	 * @deprecated
	 *
	 * use indexes replaced
	 */
	indexs: DbIndex[];
	indexes: DBIndex[];
};

/**
 * @deprecated
 * 
 * use AtLeastOne replaced
 * 
 * will remove in next release version
 */
export type AtleastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

type IDBKeyRangeInstance = typeof IDBKeyRange;

type Convert<T> = {
	[K in keyof T]: {
		type: K;
		rangeValue: T[K] extends (...args: any[]) => unknown ? Parameters<T[K]> : never;
	};
}[keyof T];

/**
 * @deprecated
 * 
 * use ConditionMap replaced
 * 
 * will remove in next release version
 */
export interface MapCondition {
	equal: (value: any) => IDBKeyRange;
	gt: (lower: any, open?: boolean) => IDBKeyRange;
	lt: (upper: any, open?: boolean) => IDBKeyRange;
	between: (
		lower: any,
		upper: any,
		lowerOpen?: boolean,
		upperOpen?: boolean,
	) => IDBKeyRange;
}

export interface ConditionMap {
	equal: IDBKeyRangeInstance['only'];
	gt: IDBKeyRangeInstance['lowerBound'];
	lt: IDBKeyRangeInstance['upperBound'];
	between: IDBKeyRangeInstance['bound'];
}

export interface DBRequestEventTarget extends EventTarget {
	result: IDBDatabase;
}

export interface DBRequestEvent extends Event {
	target: DBRequestEventTarget;
}
/**
 * @deprecated
 *
 * use DbOperator replaced
 *
 * will remove in next release version
 */
export interface DbOperate<T> {
	tableName: string;
	key: string;
	data: T | T[];
	value: string | number;
	countCondition: {
		type: 'equal' | 'gt' | 'lt' | 'between';
		rangeValue: [any, any?, any?, any?];
	};
	condition(data: T): boolean;
	success(res: T[] | T): void;
	handle(res: T): void;
}

export interface DbOperator<T> {
	/**
	 * @deprecated
	 *
	 * use name replaced
	 *
	 * will remove in next release version
	 */
	tableName: string;
	name: string;
	key: string;
	data: T | T[];
	value: string | number;
	countCondition: Convert<ConditionMap>;
	condition(data: T): boolean;
	success(res: T[] | T): void;
	handle(res: T): void;
}
