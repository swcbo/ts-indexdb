import { describe, it, expect, afterEach } from 'vitest';
import { getInstance, init } from '../libs';

const options = { name: 'testDB', version: 1, tables: [] }; // 示例选项

describe('IndexDB Singleton', () => {
	afterEach(() => {
		// 确保每次执行用例前, 都回归为初始状态
		try {
			const instance = getInstance();
			instance.close();
		} catch {
			console.log('instance existed');
		}
	});

	it('should create an IndexDB instance with init', async () => {
		const dbInstance = await init(options);
		expect(dbInstance).toBeDefined();
	});
	// 确保之前没有初始化实例
	// 此步骤可能需要根据你的实际实现调整，以确保实例未初始化
	it('should throw an error when getInstance is called without initialization', () => {
		expect(() => getInstance()).toThrow(
			'IndexDB instance not initialized. Call init() first.',
		);
	});
	// 多次init后，实例应该依旧为第一次初始化时产生的
	it('should return the same instance on subsequent calls to init', async () => {
		const firstInstance = await init(options);
		const secondInstance = await init(options);
		expect(firstInstance).toBe(secondInstance);
	});
	// 初始化后，根据 indexDB instance 的 connect status 确认是否 已完成数据库连接
	it('should indicate the database is open after initialization', async () => {
		await init(options);
		const instance = getInstance();
		expect(instance.getConnectStatus()).toBeTruthy();
	});
});