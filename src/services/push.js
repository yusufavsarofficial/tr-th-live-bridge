const webPush = require("web-push");

function createPushService(config) {
  function initialize(vapidKeys, pushSubscriptions) {
    webPush.setVapidDetails(config.vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);
  }

  function sendPush(subscription, payload, ttl, urgency = "normal") {
    return webPush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttl, urgency }).catch((error) => {
      if (error?.statusCode === 404 || error?.statusCode === 410) return "unsubscribed";
      console.error("Push failed:", error?.message || error);
      return "error";
    });
  }

  return { initialize, sendPush };
}

module.exports = { createPushService };
