document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();
  const statusMessage = document.getElementById("statusMessage");

  if (name === "" || email === "" || message === "") {
    statusMessage.textContent = "Please fill in all fields.";
    statusMessage.style.color = "red";
    return;
  }

  // Simulate sending message
  statusMessage.textContent = "Message sent successfully!";
  statusMessage.style.color = "green";

  // Clear form
  document.getElementById("contactForm").reset();
});
