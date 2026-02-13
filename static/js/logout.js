const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.clear();
    window.location.href = "/login/";
  };
}
