// Service worker de la PWA — volontairement MINIMAL : uniquement les
// notifications push. Pas de handler `fetch`, donc AUCUN cache applicatif :
// l'app installée charge toujours la dernière version déployée (les mises à
// jour restent automatiques, comme sur le site web).

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "ERP Freelance", body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "ERP Freelance", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Fenêtre déjà ouverte → focus + navigation ; sinon nouvelle fenêtre
      for (const client of clients) {
        if ("focus" in client) {
          client.focus()
          if ("navigate" in client) client.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
