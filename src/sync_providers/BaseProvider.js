var fs = require('fs')
let Utils = require('../utils')

class SyncProvider {
    constructor(name) {
        this.name = name
        this.lastData = {}
        this.currentData = {}
        this.USER_DATA_LIST = ["givenname", "lastname", "gidnumber", "mail", "activated", "accepted"]
    }

    calculateDiffForNewData(newData) {
        return Utils.calculateDiff(newData, this.currentData, this.USER_DATA_LIST)
    }

    async applyDiff(diff) {
        Utils.applyChanges(this.currentData, diff)
    }

    getCurrentState() {
        return JSON.parse(JSON.stringify(this.currentData))
    }

    async updateCurrentState() { }

    calculateDiff() {
        this.loadLastState()
        return Utils.calculateDiff(this.currentData, this.lastData, this.USER_DATA_LIST)
    }

loadLastState() {
        try {
            var data = fs.readFileSync("./data/" + this.name + ".json", { encoding: 'utf-8' });
            this.lastData = JSON.parse(data)
        } catch (error) {
            console.log(error)
            this.lastData = []
        }

    }
    safeCurrentState() {
        fs.writeFileSync("./data/" + this.name + ".json", JSON.stringify(this.currentData))
    }
}

module.exports = SyncProvider