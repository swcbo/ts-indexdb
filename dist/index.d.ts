import { TsIndexDb, IIndexDb } from "./TsIndexDb";
export declare const init: ({ dbName, version, tables }: IIndexDb) => Promise<TsIndexDb>;
export declare const getInstance: () => TsIndexDb;
