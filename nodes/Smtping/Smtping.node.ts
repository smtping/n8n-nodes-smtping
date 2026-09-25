import type {
	IDataObject,
	JsonObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

const SAFE = ['valid', 'alias'];
const AVOID = ['invalid', 'spamtrap', 'disposable', 'blacklisted', 'complainer', 'spambot', 'inbox_full'];

function band(status: string): string {
	if (SAFE.includes(status)) return 'safe';
	if (AVOID.includes(status)) return 'avoid';
	return 'judgement';
}

export class Smtping implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMTPing',
		name: 'smtping',
		icon: { light: 'file:smtping.svg', dark: 'file:smtping.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Verify email addresses with SMTPing',
		defaults: { name: 'SMTPing' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'smtpingApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'Check', value: 'check' },
					{ name: 'Bulk Job', value: 'bulk' },
					{ name: 'Account', value: 'account' },
				],
				default: 'email',
			},

			// ── Email ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['email'] } },
				options: [
					{
						name: 'Verify',
						value: 'verify',
						description: 'Full verification: syntax, DNS, mailbox and every threat list',
						action: 'Verify an email address',
					},
				],
				default: 'verify',
			},

			// ── Check ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['check'] } },
				options: [
					{ name: 'Complainer', value: 'complainer', description: 'History of marking mail as spam', action: 'Check complainer list' },
					{ name: 'Disposable', value: 'disposable', description: 'Temporary or throwaway address', action: 'Check disposable list' },
					{ name: 'Spambot', value: 'spambot', description: 'Automated clicking and fake engagement', action: 'Check spambot list' },
					{ name: 'Spamtrap', value: 'spamtrap', description: 'Address that exists only to catch senders', action: 'Check spamtrap list' },
				],
				default: 'spamtrap',
			},

			// ── Bulk ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['bulk'] } },
				options: [
					{ name: 'Submit', value: 'submit', description: 'Send a list of addresses as one job', action: 'Submit a bulk job' },
					{ name: 'Get Status', value: 'status', description: 'Progress of a job', action: 'Get bulk job status' },
					{ name: 'Get Results', value: 'result', description: 'Results of a finished job, one item per address', action: 'Get bulk job results' },
				],
				default: 'submit',
			},

			// ── Account ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{ name: 'Get Credits', value: 'credits', description: 'Remaining credit balance', action: 'Get credit balance' },
				],
				default: 'credits',
			},

			// ── Fields ──
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@example.com',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['email', 'check'] } },
			},
			{
				displayName: 'Emails Source',
				name: 'source',
				type: 'options',
				displayOptions: { show: { resource: ['bulk'], operation: ['submit'] } },
				options: [
					{ name: 'All Input Items (One Job)', value: 'items', description: 'Collect one address per input item and submit them together' },
					{ name: 'List Field', value: 'list', description: 'A single field holding an array, or text separated by commas or new lines' },
				],
				default: 'items',
			},
			{
				displayName: 'Email Field',
				name: 'emailField',
				type: 'string',
				default: 'email',
				required: true,
				description: 'Name of the field that holds the address in each input item',
				displayOptions: { show: { resource: ['bulk'], operation: ['submit'], source: ['items'] } },
			},
			{
				displayName: 'Emails',
				name: 'emails',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				placeholder: 'a@example.com, b@example.com',
				displayOptions: { show: { resource: ['bulk'], operation: ['submit'], source: ['list'] } },
			},
			{
				displayName: 'Wait for Results',
				name: 'wait',
				type: 'boolean',
				default: false,
				description: 'Whether to poll the job until it finishes and output one item per address. Leave off for large lists and use Get Status / Get Results later.',
				displayOptions: { show: { resource: ['bulk'], operation: ['submit'] } },
			},
			{
				displayName: 'Max Wait (Minutes)',
				name: 'maxWait',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 120 },
				default: 15,
				displayOptions: { show: { resource: ['bulk'], operation: ['submit'], wait: [true] } },
			},
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['bulk'], operation: ['status', 'result'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['email', 'bulk'], operation: ['verify', 'submit', 'result'] } },
				options: [
					{
						displayName: 'Add Band Field',
						name: 'addBand',
						type: 'boolean',
						default: true,
						description: 'Whether to add a "band" field (safe, avoid, judgement) for easy routing with an IF or Switch node',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('smtpingApi');
		const baseUrl = String(credentials.baseUrl || 'https://api.smtping.com/api/v1').replace(/\/+$/, '');
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const call = async (method: IHttpRequestMethods, path: string, body?: IDataObject, itemIndex = 0): Promise<any> => {
			const options: IHttpRequestOptions = {
				method,
				url: baseUrl + path,
				json: true,
				timeout: 60000,
				headers: { Accept: 'application/json', 'User-Agent': 'n8n-nodes-smtping/0.1.2' },
			};
			if (body) options.body = body;
			try {
				return await this.helpers.httpRequestWithAuthentication.call(this, 'smtpingApi', options);
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		};

		const withBand = (row: IDataObject, i: number): IDataObject => {
			const opts = this.getNodeParameter('options', i, {}) as IDataObject;
			if (opts.addBand !== false && typeof row.status === 'string') row.band = band(row.status);
			return row;
		};

		const fetchResults = async (jobId: string, i: number): Promise<INodeExecutionData[]> => {
			const rows = await call('GET', `/verify/bulk/${encodeURIComponent(jobId)}/result`, undefined, i);
			const list: IDataObject[] = Array.isArray(rows) ? rows : (rows?.results ?? []);
			return list.map((r) => ({ json: withBand({ jobId, ...r }, i), pairedItem: { item: i } }));
		};

		// Bulk submit from all items runs once for the whole input.
		if (resource === 'bulk' && operation === 'submit') {
			const allItems = items.map((_, index) => ({ item: index }));
			const source = this.getNodeParameter('source', 0) as string;
			let emails: string[] = [];
			if (source === 'items') {
				const field = this.getNodeParameter('emailField', 0) as string;
				emails = items.map((it) => String((it.json as IDataObject)[field] ?? '').trim());
			} else {
				const raw = this.getNodeParameter('emails', 0) as unknown;
				emails = Array.isArray(raw) ? raw.map(String) : String(raw).split(/[\s,;]+/);
			}
			emails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
			if (!emails.length) throw new NodeOperationError(this.getNode(), 'No valid email address found in the input.');
			if (emails.length > 100000) throw new NodeOperationError(this.getNode(), 'A bulk job accepts up to 100,000 addresses. Split the input.');

			const job = await call('POST', '/verify/bulk', { emails });
			const jobId = String(job?.jobId ?? '');
			if (!jobId) throw new NodeOperationError(this.getNode(), 'The API did not return a job ID.');

			if (!(this.getNodeParameter('wait', 0) as boolean)) {
				return [[{ json: { jobId, status: job.status ?? 'Queued', totalEmails: emails.length }, pairedItem: allItems }]];
			}

			const deadline = Date.now() + (this.getNodeParameter('maxWait', 0) as number) * 60000;
			let delay = 5000;
			while (Date.now() < deadline) {
				await sleep(delay);
				delay = Math.min(delay * 1.5, 30000);
				let st: IDataObject;
				try {
					st = await call('GET', `/verify/bulk/${encodeURIComponent(jobId)}`);
				} catch (e) {
					const code = Number((e as any)?.httpCode ?? 0);
					if (code === 409 || code === 429 || code >= 500 || code === 0) continue;
					throw new NodeApiError(this.getNode(), e as JsonObject);
				}
				if (st.status === 'Succeeded') return [await fetchResults(jobId, 0)];
				if (st.status === 'Failed' || st.status === 'Cancelled') {
					throw new NodeOperationError(this.getNode(), `Job ${jobId} ${String(st.status).toLowerCase()}${st.errorMessage ? ': ' + st.errorMessage : ''}`);
				}
			}
			return [[{ json: { jobId, status: 'Processing', timedOut: true, totalEmails: emails.length }, pairedItem: allItems }]];
		}

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'email') {
					const email = (this.getNodeParameter('email', i) as string).trim();
					const res = await call('POST', '/verify/single', { email }, i);
					out.push({ json: withBand(res, i), pairedItem: { item: i } });
				} else if (resource === 'check') {
					const email = (this.getNodeParameter('email', i) as string).trim();
					const res = await call('POST', `/checks/${operation}`, { email }, i);
					out.push({ json: { email, check: operation, ...res }, pairedItem: { item: i } });
				} else if (resource === 'bulk') {
					const jobId = (this.getNodeParameter('jobId', i) as string).trim();
					if (operation === 'status') {
						const res = await call('GET', `/verify/bulk/${encodeURIComponent(jobId)}`, undefined, i);
						out.push({ json: { jobId, ...res }, pairedItem: { item: i } });
					} else {
						out.push(...(await fetchResults(jobId, i)));
					}
				} else if (resource === 'account') {
					const res = await call('GET', '/credits', undefined, i);
					out.push({ json: res, pairedItem: { item: i } });
					break; // One balance is enough, whatever the input size.
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
