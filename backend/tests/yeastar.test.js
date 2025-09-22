// backend/tests/yeastar.test.js
const nock = require('nock');
const YeastarClient = require('../services/yeastarClient');

// Mock des dépendances de la base de données
const db = {
  updatePbxApiVersion: jest.fn().mockResolvedValue(true),
};

const YEASTAR_IP = '10.1.0.254';
const API_USER = 'testuser';
const API_PASS = 'testpass';

const v1Config = {
  ipAddress: YEASTAR_IP,
  apiUser: API_USER,
  apiPasswordEncrypted: API_PASS,
  apiVersion: 1
};

const v2Config = {
    ...v1Config,
    apiVersion: 2
};


describe('YeastarClient', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('Version Auto-Detection', () => {
        it('should detect and switch to API v2 if available', async () => {
            nock(`http://${YEASTAR_IP}`)
                .get('/api/v2/system/version')
                .reply(200, { data: { version: '37.8.0.25' } });

            nock(`http://${YEASTAR_IP}`)
                .post('/api/v2/login', { username: API_USER, password: API_PASS })
                .reply(200, { data: { token: 'fake-v2-token', expire: 3600 } });

            const client = new YeastarClient(v1Config, db); // Start with v1 config
            await client._initialize();

            expect(client.apiVersion).toBe(2);
            expect(client.apiToken).toBe('fake-v2-token');
            expect(db.updatePbxApiVersion).toHaveBeenCalledWith(v1Config.id, 2);
        });

        it('should remain on API v1 if v2 endpoint fails', async () => {
            nock(`http://${YEASTAR_IP}`)
                .get('/api/v2/system/version')
                .reply(404);

            const client = new YeastarClient(v1Config, db);
            await client._initialize();

            expect(client.apiVersion).toBe(1);
            expect(client.apiToken).toBeNull();
        });
    });

    describe('Originate Call', () => {
        it('should correctly format an originate request for API v1', async () => {
            nock(`http://${YEASTAR_IP}`)
                .get('/api/v2/system/version')
                .reply(404); // Force v1

            const scope = nock(`http://${YEASTAR_IP}`)
                .post('/api/v1/call/originate', body => {
                    return body.channel === 'PJSIP/1001' && // or SIP/1001
                           body.exten === '0612345678' &&
                           body.callerid === '0199887766';
                })
                .basicAuth({ user: API_USER, pass: API_PASS })
                .reply(200, {
                    response: {
                        status: 'Success',
                        call_id: 'call-id-12345'
                    }
                });

            const client = new YeastarClient(v1Config, db);
            const result = await client.originate('1001', '0612345678', '0199887766');

            expect(result).toEqual({ pbxCallId: 'call-id-12345' });
            expect(scope.isDone()).toBe(true);
        });

        it('should correctly format an originate request for API v2', async () => {
             nock(`http://${YEASTAR_IP}`)
                .get('/api/v2/system/version')
                .reply(200, { data: { version: '37.8.0.25' } });
            
            nock(`http://${YEASTAR_IP}`)
                .post('/api/v2/login')
                .reply(200, { data: { token: 'fake-v2-token' } });

            const scope = nock(`http://${YEASTAR_IP}`, {
                reqheaders: {
                    'Authorization': 'Bearer fake-v2-token'
                }
            })
            .post('/api/v2/call/originate', {
                channel: 'PJSIP/1001',
                extension: '0612345678',
                callerid: '0199887766'
            })
            .reply(200, { data: { call_id: 'call-id-67890' } });

            const client = new YeastarClient(v2Config, db);
            await client._initialize();
            const result = await client.originate('1001', '0612345678', '0199887766');
            
            expect(result).toEqual({ pbxCallId: 'call-id-67890' });
            expect(scope.isDone()).toBe(true);
        });
    });
});
