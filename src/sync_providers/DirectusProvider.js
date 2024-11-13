const SyncProvider = require("./BaseProvider");
var d = require('@directus/sdk')
const DirectusHelper = require("../DirectusHelper");

class DirectusProvider extends SyncProvider {
    constructor(){
        super("directus")
        this.role_to_group_map = {"member": "mitglied", "contender": "anwaerter", "alumni": "alumni"}
    }

    async init(){
        super.init()
        this.client = await DirectusHelper.getDirectusClient()
    }

    async applyDiff(diff) {
        console.log("Syncing to " + this.name)
        console.log(diff)

        for(let userAdded of diff.addedUsers){
            await this.client.request(d.createItem("Gatrobe_Users", userAdded))
        }
        for(let userRemoved of diff.deletedUsers){
            let user = this.currentData.find(e => e.ipa_uid === userRemoved)
            if(!user) continue
            await this.client.request(d.deleteItem("Gatrobe_Users", user.directus_id))
        }
        for(let dataChange of diff.dataChange){
            let user = this.currentData.find(e => e.ipa_uid === dataChange.ipa_uid)
            if(!user) continue
            let partialObject = {}
            partialObject[dataChange.field_name] = dataChange.new_value
            await this.client.request(d.updateItem("Gatrobe_Users", user.directus_id, partialObject))    
        }
        let directusGroupAdds = {}
        for(let groupAdded of diff.groupsAdded) {
            let user = this.currentData.find(e => e.ipa_uid === groupAdded.ipa_uid)
            if(!user) continue
            if(user.groups.includes(groupAdded.group_cn)) {continue}
            if(!directusGroupAdds[user.ipa_uid]) directusGroupAdds[user.ipa_uid] = []
            directusGroupAdds[user.ipa_uid].push(groupAdded.group_cn)
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
            await this.client.request(d.updateItem("Gatrobe_Users", user.directus_id, {"groups": user.groups.concat(directusGroupAdds[ipa_uid])}))
        }
        for(let ipa_uid in directusGroupRemoves){
            let user = this.currentData.find(e => e.ipa_uid === ipa_uid)
            let groups = [...user.groups]
            directusGroupRemoves[ipa_uid].forEach(e => {
                groups.splice(groups.indexOf(e), 1)
            })
            await this.client.request(d.updateItem("Gatrobe_Users", user.directus_id, {"groups": groups}))
        }
        super.applyDiff(diff)
    }
    
    async updateCurrentState() {
        console.log("Updating state for " + this.name)

        this.currentData = await this.client.request(d.readItems("Gatrobe_Users", {}))
        console.log(this.currentData)
        this.currentData.forEach(user => {
            if(!user.groups) user.groups = []
            if(!user.accepted) return
            user.groups = user.groups.filter(i => !Object.values(this.role_to_group_map).includes(i))
            if(user.Role) {
                user.groups.push(this.role_to_group_map[user.Role])
            }
        });
    }
}

module.exports = DirectusProvider