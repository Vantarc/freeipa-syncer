const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');


class GoogleAPI {

  // If modifying these scopes, delete token.json.
  SCOPES = ['https://www.googleapis.com/auth/admin.directory.user'];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  TOKEN_PATH = path.join(process.cwd(), './credentials/google_token.json');
  CREDENTIALS_PATH = path.join(process.cwd(), './credentials/google_credentials.json');

  /**
   * Reads previously authorized credentials from the save file.
   *
   * @return {Promise<OAuth2Client|null>}
   */
  async loadSavedCredentialsIfExist() {
    try {
      const content = await fs.readFile(this.TOKEN_PATH);
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
    }
  }

  /**
   * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
   *
   * @param {OAuth2Client} client
   * @return {Promise<void>}
   */
  async saveCredentials() {
    const content = await fs.readFile(this.CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: this.client.credentials.refresh_token,
    });
    await fs.writeFile(this.TOKEN_PATH, payload);
  }

  /**
   * Load or request or authorization to call APIs.
   *
   */
  async authorize() {
    this.client = await this.loadSavedCredentialsIfExist();
    if (this.client) {
      return;
    }
    this.client = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: this.CREDENTIALS_PATH,
    });
    if (this.client.credentials) {
      await this.saveCredentials();
    }
    this.service = google.admin({ version: 'directory_v1', "auth": this.client });

  }

  /**
   * Lists the first 10 users in the domain.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  async listUsers() {
    const service = google.admin({ version: 'directory_v1', "auth": this.client });
    const res = await service.users.list({
      customer: 'my_customer',
      orderBy: 'email',
    });

    const users = res.data.users;
    if (!users || users.length === 0) {
      console.log('No users found.');
      return [];
    }

    return users
  }

  async addUser(firstName, lastName, email, ipa_uid) {
    const service = google.admin({ version: 'directory_v1', "auth": this.client });
    const res = await service.users.insert({requestBody:{
      "primaryEmail": email,
      "name": {
        "givenName": firstName,
        "familyName": lastName
      },
      "password": randomUUID(),
      

      "externalIds": [{"type": "login_id", "value": ipa_uid}],
      "organizations": [{
        "name": "Arbeitssaal Gatrobe e.V.",
        "domain": "gatrobe.de",
        "primary": true
      }]
    }});
  }

}

module.exports = GoogleAPI