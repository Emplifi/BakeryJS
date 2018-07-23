import {VisualBuilder} from './VisualBuilder';
import {
	ConcurrentSchemaComponent,
	SchemaObject,
	SerialSchemaComponent,
} from '../FlowBuilderI';

const TERMINAL_WIDTH = 80;

export class DefaultVisualBuilder implements VisualBuilder {
	public build(schema: SchemaObject): string {
		return this.printSchema(schema);
	}

	private printSchema(schema: SchemaObject, indent: string = ''): string {
		let output = '';
		for (const key of Object.keys(schema)) {
			output += `${indent}* ${key} ${'*'.repeat(
				TERMINAL_WIDTH - 3 - indent.length - key.length
			)}\n`;
			indent += '* ';
			output += this.printSerial(schema[key], indent);
			indent = indent.substr(0, indent.length - 2);
			output += `${indent}${'*'.repeat(
				TERMINAL_WIDTH - indent.length
			)}\n`;
		}
		return output;
	}

	private printSerial(
		series: SerialSchemaComponent,
		indent: string = ''
	): string {
		let output = '';
		output += `${indent}SERIAL ${'-'.repeat(
			TERMINAL_WIDTH - 7 - indent.length
		)}\n`;
		for (const serial of series) {
			indent += '| ';
			output += this.printConcurrent(serial, indent);
			indent = indent.substr(0, indent.length - 2);
		}
		output += `${indent}${'-'.repeat(TERMINAL_WIDTH - indent.length)}\n`;
		return output;
	}

	private printConcurrent(
		concurrencies: ConcurrentSchemaComponent,
		indent: string = ''
	): string {
		let output = '';
		output += `${indent}CONCURRENT ${'-'.repeat(
			TERMINAL_WIDTH - 11 - indent.length
		)}\n`;
		for (const concurrent of concurrencies) {
			indent += '  ';
			if (typeof concurrent !== 'string') {
				output += this.printSchema(concurrent, indent);
				output += `${indent}${' '.repeat(
					TERMINAL_WIDTH - indent.length
				)}\n`;
			} else {
				output += `${indent}- ${concurrent}\n`;
			}
			indent = indent.substr(0, indent.length - 2);
		}
		output += `${indent}${'-'.repeat(TERMINAL_WIDTH - indent.length)}\n`;
		return output;
	}
}
