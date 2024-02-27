import { describe, it, expect } from 'vitest';
import { getInstance, init } from '../libs';

describe('IndexDB Singleton', () => {
	const options = { name: 'testDB', version: 1, tables: [] }; // 示例选项

	it('should create an IndexDB instance with init', async () => {
		const dbInstance = await init(options);
		expect(dbInstance).toBeDefined();
		// 间接测试通过公共方法或观察行为
	});

	it('should throw an error when getInstance is called without initialization', () => {
		const a = getInstance();
		console.log('a',a)
		// 确保之前没有初始化实例
		// 此步骤可能需要根据你的实际实现调整，以确保实例未初始化
		expect(() => getInstance()).toThrow(
			'IndexDB instance not initialized. Call init() first.',
		);
	});

	it('should return the same instance on subsequent calls to init', async () => {
		const firstInstance = await init(options);
		const secondInstance = await init(options);
		expect(firstInstance).toBe(secondInstance);
	});

	// 如果有可能验证实例状态的公开方法，可以添加更多测试
	// 例如，假设有一个方法可以检查数据库是否打开
	it('should indicate the database is open after initialization', async () => {
	  await init(options);
      const instance = getInstance()
	  expect(instance.getConnectStatus()).toBeTruthy();
	});
});