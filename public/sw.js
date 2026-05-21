self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Nova";
  const type = payload.type || "message";
  const isUrgent = type === "urgent" || payload.urgent === "true";
  const isCall = type === "call";
  const options = {
    body: payload.body || "",
    tag: payload.tag || (isUrgent ? "pingle-urgent" : "pingle"),
    renotify: isUrgent || isCall,
    data: {
      url: payload.url || "/",
      type,
      timestamp: payload.timestamp || Date.now(),
    },
    icon: "/assets/nova-logo.svg",
    badge: "/assets/nova-logo.svg",
    vibrate: isUrgent ? [320, 110, 320, 110, 500, 140, 650] : isCall ? [180, 80, 180, 80, 180] : [120, 80, 120],
    requireInteraction: isUrgent || isCall,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
        return;
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
