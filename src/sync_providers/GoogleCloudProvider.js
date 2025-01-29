const SyncProvider = require("./BaseProvider");
const credentials = require("../credentials");
const KeycloakHelper = require("../KeycloakHelper");
const GoogleAPI = require("../GoogleWrapper");


class GoogleCloudProvider extends SyncProvider {

    constructor(){
        super("google")
        this.googleAPIWrapper = new GoogleAPI()
    }

    async init(){
        super.init()
        await this.googleAPIWrapper.authorize()

        
    }

    async applyDiff(diff) {
        
        console.log("Syncing to " + this.name)
        
        for(let userAdded of diff.addedUsers){
            await this.googleAPIWrapper.addUser(userAdded.givenname, userAdded.lastname, userAdded.ipa_uid + "@gatrobe.de", userAdded.ipa_uid)
        }
        
        super.applyDiff(diff)
    }

    calculateDiffForNewData(newData){
        let changes = super.calculateDiffForNewData(newData)
        
        changes.diff.deletedUsers = []
        changes.diff.dataChange = []
        changes.diff.groupsAdded = []
        changes.diff.groupsRemoved = []
        changes.diffCount = 0
        
        let newaddedUsers = []
        for(let userAdd of changes.diff.addedUsers) {
            if(!userAdd.accepted) continue
            if(userAdd.groups.includes("sysuser") && !userAdd.groups.includes("googleworkspace")) continue

            newaddedUsers.push(userAdd)
        }
        changes.diff.addedUsers = newaddedUsers
        return changes
    }

    
    async updateCurrentState() {
        
        console.log("Updating state for " + this.name)
        let users = await this.googleAPIWrapper.listUsers()
        this.currentData = []
        users.forEach(user => {
            if(!user.primaryEmail.endsWith("@gatrobe.de")) return 
            this.currentData.push({
                "ipa_uid": user.primaryEmail.replace("@gatrobe.de", ""),
                "groups": []
            })
        })
    }
}

module.exports = GoogleCloudProvider