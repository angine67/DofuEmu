;(function () {
  try {
    /* __ATTACH_BODY__ */
    if (window.$_deExposeLoginAndCert_v2) return
    window.$_deExposeLoginAndCert_v2 = true
    attach()
    setTimeout(attach, 0)
    setTimeout(attach, 500)
    setInterval(attach, 2000)
  } catch (err) {
    console.error('DofEmu expose helpers init failed:', err)
  }
})()
