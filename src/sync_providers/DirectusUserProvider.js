const SyncProvider = require("./BaseProvider");
var d = require('@directus/sdk')
const credentials = require("../credentials");
const DirectusHelper = require("../DirectusHelper");

class DirectusUserProvider extends SyncProvider {

    IGNORE_GROUPS_WHEN_SYNCING = ["$t:public_label"]

    constructor(){
        super("directus_user")     
    }

    async init(){
        super.init()
        this.client = await DirectusHelper.getDirectusClient()
    }
    async applyDiff(diff) {
        console.log("Syncing to " + this.name)
        console.log(diff)

        // login
        let directusGroupAdds = {}
        for(let groupAdded of diff.groupsAdded) {
            let user = this.currentData.find(e => e.ipa_uid === groupAdded.ipa_uid)
            if(!user) continue
            if(user.groups.includes(groupAdded.group_cn)) {continue}
            if(!directusGroupAdds[user.ipa_uid]) directusGroupAdds[user.ipa_uid] = []
            directusGroupAdds[user.ipa_uid].push({
                "policy": {
                    "id": this.ROLE_TO_POLICY_ID_MAPPING[groupAdded.group_cn]
                },
                "user": user.directus_id
            })
        }
        let directusGroupRemoves = {}
        for(let groupRemoved of diff.groupsRemoved) {
            let user = this.currentData.find(e => e.ipa_uid === groupRemoved.ipa_uid)
            if(!user) continue
            if(!user.groups.includes(groupRemoved.group_cn)) {continue}
            if(!directusGroupRemoves[user.ipa_uid]) directusGroupRemoves[user.ipa_uid] = []
            directusGroupRemoves[user.ipa_uid].push(groupRemoved.group_cn)
        }

        for(let ipa_uid in directusGroupAdds){
            let user = this.currentData.find(e => e.ipa_uid === ipa_uid)
            console.log("New policy array:")
            console.log(user.groups.concat(directusGroupAdds[ipa_uid]))
            await this.client.request(d.updateUser(user.directus_id, {"policies": user.policies.concat(directusGroupAdds[ipa_uid])}))
        }
        for(let ipa_uid in directusGroupRemoves){
            let user = this.currentData.find(e => e.ipa_uid === ipa_uid)
            let policies = [...user.policies]
            directusGroupRemoves[ipa_uid].forEach(e => {
                policies.splice(policies.findIndex(el => {el.policy.id === this.ROLE_TO_POLICY_ID_MAPPING[ipa_uid]}), 1)
            })
            await this.client.request(d.updateUser(user.directus_id, {"policies": policies}))
        }


        super.applyDiff(diff)
    }
    
    async updatePolicyMapping(){
        this.POLICY_ID_TO_ROLE_MAPPING = {}
        this.ROLE_TO_POLICY_ID_MAPPING = {}
        let policies = await this.client.request(d.readPolicies())
        policies.forEach(plc => {
            if(this.IGNORE_GROUPS_WHEN_SYNCING.includes(plc.name)) return
            this.ROLE_TO_POLICY_ID_MAPPING[plc.name] = plc.id
            this.POLICY_ID_TO_ROLE_MAPPING[plc.id] = plc.name
        })
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
            if(!Object.keys(this.ROLE_TO_POLICY_ID_MAPPING).includes(groupAdd.group_cn)){
                continue
            }
            changeCount += 1
            newGroupAdds.push(groupAdd)
        }
        changes.diff.groupsAdded = newGroupAdds

        // same for groups removed
        let newGroupRemoved = []
        for(let groupRemoved of changes.diff.groupsRemoved) {
            if(!Object.keys(this.ROLE_TO_POLICY_ID_MAPPING).includes(groupRemoved.group_cn)){
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
 
        await this.updatePolicyMapping()
        let users = await this.client.request(d.readUsers({fields: ['*', {policies: [{policy: ['id']}]}]}))

        this.currentData = []
        users.forEach(user => {
            if(user.provider !== 'keycloak') return
            let user_object = {}
            user_object.ipa_uid = user.external_identifier
            user_object.directus_id = user.id
            user_object.policies = user.policies
            user_object.groups = []
            user.policies.forEach(plc => {
                if(!this.POLICY_ID_TO_ROLE_MAPPING[plc.policy.id]) return
                user_object.groups.push(this.POLICY_ID_TO_ROLE_MAPPING[plc.policy.id])
            })
            this.currentData.push(user_object)
        });

    }
}

module.exports = DirectusUserProvider