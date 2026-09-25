import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SmtpingApi implements ICredentialType {
	name = 'smtpingApi';

	displayName = 'SMTPing API';

	documentationUrl = 'https://smtping.com/docs';

	icon: Icon = { light: 'file:smtping.svg', dark: 'file:smtping.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create a key in the SMTPing dashboard (app.smtping.com)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.smtping.com/api/v1',
			description: 'Change only for staging environments',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/credits',
			method: 'GET',
		},
	};
}
