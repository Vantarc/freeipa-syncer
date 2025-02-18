const SyncProvider = require("./BaseProvider");
const ipa = require('node-freeipa')
const credentials = require("../credentials")

class FreeIPAProvider extends SyncProvider {
    constructor() {
        super("freeIPA")
        const opts = {
            server: "ipa.gatrobe.de",
            auth: {
                user: credentials.FREEIPA_USERNAME,
                pass: credentials.FREEIPA_PASSWORD
            },
            cacheFolder: "./credentials/",
            expires: 60
        };

        ipa.configure(opts);
        ipa.json_metadata().then(result => {
        }).catch(error => {
        });
        this.USER_DATA_LIST.push("Studiengang")
        this.USER_DATA_LIST.push("Postleitzahl")
        this.USER_DATA_LIST.push("Ort")
        this.USER_DATA_LIST.push("Strasse")
        this.USER_DATA_LIST.push("Telefonnummer")
        this.USER_DATA_LIST.push("Geburtstag")

    }
    async logout(){
        await ipa.session_logout()
    }

    async applyDiff(diff) {
        console.log("Syncing to " + this.name)
        console.log(diff)
        // login
        for (let userAdded of diff.addedUsers) {
            if (userAdded.accepted) {
                await ipa.user_add([userAdded.ipa_uid], { "givenname": userAdded.givenname, "sn": userAdded.lastname, "cn": userAdded.givenname + " " + userAdded.lastname, "mail": userAdded.mail, "nsaccountlock": (!userAdded.activated).toString() })
            } else {
                await ipa.stageuser_add([userAdded.ipa_uid], { "givenname": userAdded.givenname, "sn": userAdded.lastname, "cn": userAdded.givenname + " " + userAdded.lastname, "mail": userAdded.mail})
            }
        }
        for (let userRemoved of diff.deletedUsers) {
            let user = this.currentData.find(e => e.ipa_uid === userRemoved)
            if (!user) continue
            if (user.accepted) {
                await ipa.user_del([userRemoved])
            } else {
                await ipa.stageuser_del([userRemoved])
            }
        }
        for (let dataChange of diff.dataChange) {
            let user = this.currentData.find(e => e.ipa_uid === dataChange.ipa_uid)
            if (!user) continue
            switch (dataChange.field_name) {
                case "activated":
                    if(user.activated && !dataChange.new_value) {
                        // deactivate user
                        ipa.user_disable([dataChange.ipa_uid])
                    } else if (!user.activated && dataChange.new_value) {
                        // activate user
                        ipa.user_enable([dataChange.ipa_uid])
                    }
                    break;
                case "accepted":
                    if (!user.activated && dataChange.new_value) {
                        // activate user
                        ipa.stageuser_activate([dataChange.ipa_uid])
                    }
                    break;
            }
            let command = ipa.stageuser_mod
            if (user.activated) {
                command = ipa.user_mod
            }

            let field_name_map = {
                "lastname":"sn",
                "givenname": "givenname",
                "mail": "mail",
                "Geburtstag": "carlicense",
                "Telefonnummer": "telephonenumber",
                "Strasse": "street",
                "Ort": "l",
                "Postleitzahl": "postalcode",
                "Studiengang": "userclass",
            }
            if(!Object.keys(field_name_map).includes(dataChange.field_name)) continue
            let partialObject = {}
            partialObject[field_name_map[dataChange.field_name]] = dataChange.new_value

            let log = await command([dataChange.ipa_uid], partialObject)
        }
        for (let groupAdded of diff.groupsAdded) {
            let user = this.currentData.find(e => e.ipa_uid === groupAdded.ipa_uid)
            if (!user) continue
            if (user.groups.includes(groupAdded.group_cn)) { continue }

            await ipa.group_add_member([groupAdded.group_cn], { "user": user.ipa_uid})
        }
        for (let groupRemoved of diff.groupsRemoved) {
            let user = this.currentData.find(e => e.ipa_uid === groupRemoved.ipa_uid)
            if (!user) continue
            if (!user.groups.includes(groupRemoved.group_cn)) { continue }

            await ipa.group_remove_member([groupRemoved.group_cn], { "user": user.ipa_uid})

        }
        super.applyDiff(diff)
    }
    async updateCurrentState() {
        console.log("Updating state for " + this.name)
        // get all users
        let users = await ipa.user_find(undefined, { "all": true})
        let stagedUsers = await ipa.stageuser_find(undefined, { "all": true})
        if (!Array.isArray(stagedUsers)) stagedUsers = []
        // get all groups
        let groups = await ipa.group_find()

        this.currentData = []
        users.forEach(user => {
            this.currentData.push({
                "ipa_uid": user.uid[0],
                "givenname": user.givenname ? user.givenname[0] : null,
                "lastname": user.sn[0],
                "gidnumber": user.uidnumber[0],
                "mail": user.mail ? user.mail : [],
                "activated": !user.nsaccountlock,
                "accepted": true,
                "groups": [],
                "Geburtstag": user.carlicense ? user.carlicense[0] : null,
                "Telefonnummer": user.telephonenumber ? user.telephonenumber[0] : null, 
                "Strasse": user.street ? user.street[0] : null,
                "Ort": user.l ? user.l[0] : null,
                "Postleitzahl": user.postalcode ? user.postalcode[0] : null,
                "Studiengang": user.userclass ? user.userclass[0] : null,
                
            })
        });

        stagedUsers.forEach(user => {
            if(this.currentData.find((e)=> e.ipa_uid === user.uid[0])){
                fetch("https://ntfy.gatrobe.de/users", {
                    method: 'POST',
                    headers: {
                      "prio": "high",
                    },
                    body: `Es gibt einen Konflik des Names von zwei Accounts! Der Accountname ${user.uid[0]} wird von mehreren Accounts verwendet!`
                  });
                return
            }
            this.currentData.push({
                "ipa_uid": user.uid[0],
                "givenname": user.givenname ? user.givenname[0] : null,
                "lastname": user.sn[0],
                "gidnumber": user.uidnumber[0],
                "mail": user.mail ? user.mail : [],
                "activated": !user.nsaccountlock,
                "accepted": false,
                "groups": [],
                "Geburtstag": user.carlicense ? user.carlicense[0] : null,
                "Telefonnummer": user.telephonenumber ? user.telephonenumber[0] : null, 
                "Strasse": user.street ? user.street[0] : null,
                "Ort": user.l ? user.l[0] : null,
                "Postleitzahl": user.postalcode ? user.postalcode[0] : null,
                "Studiengang": user.userclass ? user.userclass[0] : null,

            })
        });
        for (const group of groups) {
            let data = await ipa.group_show([group.cn[0]])
            if (!data.member_user) continue

            data.member_user.forEach(user_uid => {
                this.currentData.find(ele => ele.ipa_uid === user_uid).groups.push(data.cn[0])
            })
        };
        console.log(this.currentData)

    }
}

module.exports = FreeIPAProvider