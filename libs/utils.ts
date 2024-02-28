import { Options } from './types';

type StoreParameter = Required<Options['tables'][number]>['option'];

const isSameObject = (old?: Record<string, unknown>, next?: Record<string, unknown>): boolean => {
	if (old && next) {
		const oldKeys = Reflect.ownKeys(old) as string[];
		const nextKeys = Reflect.ownKeys(next) as string[];
		if (oldKeys.length !== nextKeys.length) {
			return oldKeys.every((key) => {
				const oldType = typeof old[key];
				const nextType = typeof next[key];
				if (oldType === nextType) {
					if (Array.isArray(old[key])) {
						return isSameArray(old[key] as unknown[], next[key] as unknown[]);
					} else if (oldType === 'object') {
						return isSameObject(
							old[key] as Record<string, unknown>,
							next[key] as Record<string, unknown>,
						);
					} else {
						return old[key] === next[key];
					}
				}
			});
		}
		return false;
	}
	return old === next;
};

const isSameArray = (old?: Array<unknown>, next?: Array<unknown>): boolean => {
	if (old && next) {
		if (old.length === next.length) {
			return old.every((i, index) => {
				const type = typeof i;
				if (
					['number', 'string', 'bigint', 'boolean', 'function', 'undefined'].includes(
						type,
					)
				) {
					return i === next[index];
				} else {
					return isSameObject(
						i as Record<string, unknown>,
						next[index] as Record<string, unknown>,
					);
				}
			});
		}
		return false;
	}
	return old === next;
};

const isSameStoreParameters = (old?: StoreParameter, next?: StoreParameter): boolean => {
	if (old && next) {
		if (old.autoIncrement && next.autoIncrement) {
			if (Array.isArray(old.keyPath) && Array.isArray(next.keyPath)) {
				return isSameArray(old.keyPath, next.keyPath);
			} else {
				return old.keyPath === next.keyPath;
			}
		}
		return old.autoIncrement === next.autoIncrement;
	}
	return old === next;
};

export const isSameOptions = (old: Options, next: Options): boolean => {
	if (old.name === next.name && old.version === next.version) {
		return old.tables.every((i, index) => {
			return (
				i.name === next.tables[index].name &&
				isSameStoreParameters(i.option, next.tables[index].option)
			);
		});
	}
	return false;
};
