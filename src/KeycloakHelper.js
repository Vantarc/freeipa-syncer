const credentials = require("./credentials")


class KeycloakHelper {
    async  init() {
        const { default: KcAdminClient } = await import('@keycloak/keycloak-admin-client');
        this.kc_client = new KcAdminClient(
            {
                baseUrl: 'https://auth.gatrobe.de',
                realmName: 'gatrobesso',
                requestOptions: {
                  /* Fetch request options https://developer.mozilla.org/en-US/docs/Web/API/fetch#options */
                },
              }
        );
    
        await this.kc_client.auth({
            username: credentials.FREEIPA_USERNAME,
            password: credentials.FREEIPA_PASSWORD,
            grantType: 'password',
            clientId: 'admin-cli'
          });
    
    }

    async getKeycloakIDToIPAIDMapping(){
        let users = await this.kc_client.users.find();
        let userMapping = {}
        for(let user of users) {
            userMapping[user.id] = user.username
        }
        return userMapping

    }
}

module.exports = KeycloakHelper