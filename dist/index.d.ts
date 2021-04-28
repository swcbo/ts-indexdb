import { TsIndexDb, IIndexDb } from "./TsIndexDb";
/**
 * @method 初始化函数
 * @param param0
 * @param isMany
 */
export declare const init: ({ dbName, version, tables }: IIndexDb) => Promise<TsIndexDb>;
/**
 * @method 获取单例的单个对象
 */
export declare const getInstance: () => TsIndexDb;
