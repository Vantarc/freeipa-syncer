const SyncProvider = require("./BaseProvider");
const credentials = require("../credentials");
const KeycloakHelper = require("../KeycloakHelper");


class WikiJSProvider extends SyncProvider {

    GET_ALL_USERS_QUERY = `{
                users {
                    list {
                    id
                    providerKey
                    }
                }
            }`
    GET_USER_DATA_QUERY = `{
                users {
                    single(id:userID) {
                        providerId
                        groups {
                            name
                        }
                    }
                }
            }`
    LIST_GROUPS_QUERY = `{
                groups {
                    list {id name}
                }
            }`
    ADD_USER_TO_GROUP_QUERY = ` mutation {
                groups {
                    assignUser(userId:USER_ID groupId:GROUP_ID) {responseResult {succeeded}}
                }
            }`
    REMOVE_USER_FROM_GROUP_QUERY = `mutation {
                groups {
                    unassignUser(userId:USER_ID groupId:GROUP_ID) {responseResult {succeeded}}
                }
            }`

    KEYCLOAK_PROVIDER_ID =  "41fe04e2-4732-4581-af19-8c738a387f5b"
    SYNCED_GROUPS = ["anwaerter", "mitglied", "alumni"]

    constructor(){
        super("wikijs")
        this.kc = new KeycloakHelper()        
    }

    async applyDiff(diff) {
        
        console.log("Syncing to " + this.name)
        console.log(diff)

        // login

        for(let groupAdded of diff.groupsAdded) {
            let user = this.currentData.find(e => e.ipa_uid === groupAdded.ipa_uid)
            if(!user) continue
            if(user.groups.includes(groupAdded.group_cn)) {continue}
            await this.sendRequest(this.ADD_USER_TO_GROUP_QUERY.replace("USER_ID", user.wiki_js_id).replace("GROUP_ID", this.groupNameToIDMapping[groupAdded.group_cn]), "mutation")

        }

        for(let groupRemoved of diff.groupsRemoved) {
            let user = this.currentData.find(e => e.ipa_uid === groupRemoved.ipa_uid)
            if(!user) continue
            if(!user.groups.includes(groupRemoved.group_cn)) {continue}
            await this.sendRequest(this.REMOVE_USER_FROM_GROUP_QUERY.replace("USER_ID", user.wiki_js_id).replace("GROUP_ID", this.groupNameToIDMapping[groupRemoved.group_cn]), "mutation")

        }
        super.applyDiff(diff)
    }

    calculateDiffForNewData(newData){
        let changes = super.calculateDiffForNewData(newData)
        changes.diff.addedUsers = []
        changes.diff.deletedUsers = []
        changes.diff.dataChange = []

        // remove all changes which include groups other than in this.SYNCED_GROUPS
        let changeCount = 0
        let newGroupAdds = []
        for(let groupAdd of changes.diff.groupsAdded) {
            if(!this.SYNCED_GROUPS.includes(groupAdd.group_cn)){
                continue
            }
            changeCount += 1
            newGroupAdds.push(groupAdd)
        }
        changes.diff.groupsAdded = newGroupAdds

        // same for groups removed
        let newGroupRemoved = []
        for(let groupRemoved of changes.diff.groupsRemoved) {
            if(!this.SYNCED_GROUPS.includes(groupRemoved.group_cn)){
                continue
            }
            changeCount += 1
            newGroupRemoved.push(groupRemoved)
        }
        changes.diff.groupsRemoved = newGroupRemoved
        changes.diffCount = changeCount
        return changes
    }

    
    async updateCurrentState() {
        console.log("Updating state for " + this.name)
        await this.kc.init()
        
        let users = (await this.sendRequest(this.GET_ALL_USERS_QUERY)).data.users.list
        await this.updateGroupNameToIDMapping()
        let ipa_id_mapping = await this.kc.getKeycloakIDToIPAIDMapping()
        this.currentData = []
        for (const user of users) {
            if (user.providerKey !== this.KEYCLOAK_PROVIDER_ID) {
                continue
            }
            let userData = (await this.sendRequest(this.GET_USER_DATA_QUERY.replace("userID", user.id))).data.users.single
            if(userData.providerId === undefined){
                continue
            }
            if(ipa_id_mapping[userData.providerId] === undefined){
                continue
            }
            let groups = []
            for(const group of userData.groups){
                if(!this.SYNCED_GROUPS.includes(group.name)){
                    continue
                }
                groups.push(group.name)
            }

            this.currentData.push({
                "ipa_uid": ipa_id_mapping[userData.providerId],
                "groups": groups,
                "wiki_js_id": user.id
            })
        }
    }

    async updateGroupNameToIDMapping() {
        let groups = (await this.sendRequest(this.LIST_GROUPS_QUERY)).data.groups.list
        this.groupNameToIDMapping = {}
        for(let group of groups) {
            this.groupNameToIDMapping[group.name.toLowerCase()] = group.id
        }
    }


    async sendRequest(request, type) {
            return await fetch("https://wiki.gatrobe.de/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${credentials.WIKI_JS_KEY}`
    
            },
            //body: JSON.stringify({ query: "{   __type(name:\"UserMinimal\") {fields {name description}  }}" })
            body: JSON.stringify({query: request}),
        }).then(r => {return r.json()})
        
    }
}

module.exports = WikiJSProvider