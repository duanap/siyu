<template>
  <main>
    <section>
      <h1>无权限访问</h1>
      <p>当前账号没有访问此页面的权限。</p>
      <RouterLink to="/account">返回账号页</RouterLink>
    </section>
  </main>
</template>
<style scoped>
main {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 16px;
}
a {
  display: inline-grid;
  min-height: 44px;
  align-items: center;
  color: var(--siyu-primary);
}
</style>
