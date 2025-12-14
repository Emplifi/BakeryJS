import { DefaultVisualBuilder } from '../DefaultVisualBuilder'
import type { FlowExplicitDescription } from '../../FlowBuilderI'

describe('DefaultVisualBuilder', () => {
	let builder: DefaultVisualBuilder

	beforeEach(() => {
		builder = new DefaultVisualBuilder()
	})

	describe('build', () => {
		it('builds visual representation for a simple linear flow', () => {
			const schema: FlowExplicitDescription = {
				process: [['boxA'], ['boxB'], ['boxC']]
			}

			const result = builder.build(schema)

			expect(result).toContain('* process')
			expect(result).toContain('SERIAL')
			expect(result).toContain('CONCURRENT')
			expect(result).toContain('- boxA')
			expect(result).toContain('- boxB')
			expect(result).toContain('- boxC')
		})

		it('builds visual representation for parallel boxes', () => {
			const schema: FlowExplicitDescription = {
				process: [['boxA', 'boxB'], ['boxC']]
			}

			const result = builder.build(schema)

			expect(result).toContain('- boxA')
			expect(result).toContain('- boxB')
			expect(result).toContain('- boxC')
		})

		it('builds visual representation for nested generator flows', () => {
			const schema: FlowExplicitDescription = {
				process: [
					[
						{
							generator: [['nestedBoxA'], ['nestedBoxB']]
						}
					],
					['boxC']
				]
			}

			const result = builder.build(schema)

			expect(result).toContain('* process')
			expect(result).toContain('* generator')
			expect(result).toContain('- nestedBoxA')
			expect(result).toContain('- nestedBoxB')
			expect(result).toContain('- boxC')
		})

		it('builds visual representation for empty process', () => {
			const schema: FlowExplicitDescription = {
				process: []
			}

			const result = builder.build(schema)

			expect(result).toContain('* process')
			expect(result).toContain('SERIAL')
		})

		it('uses asterisks and dashes for formatting', () => {
			const schema: FlowExplicitDescription = {
				process: [['boxA']]
			}

			const result = builder.build(schema)

			// Check formatting characters are used
			expect(result).toMatch(/\*+/)
			expect(result).toMatch(/-+/)
		})

		it('handles deeply nested generators', () => {
			const schema: FlowExplicitDescription = {
				process: [
					[
						{
							outerGen: [
								[
									{
										innerGen: [['deepBox']]
									}
								]
							]
						}
					]
				]
			}

			const result = builder.build(schema)

			expect(result).toContain('* outerGen')
			expect(result).toContain('* innerGen')
			expect(result).toContain('- deepBox')
		})
	})
})
