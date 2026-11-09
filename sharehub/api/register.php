<?php
// register.php - create a new account and sign the user in
require "db.php";

$d = input();
$name  = trim($d["name"] ?? "");
$email = strtolower(trim($d["email"] ?? ""));
$pass  = $d["password"] ?? "";

if ($name === "" || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) {
    send(["error" => "Enter your name, a valid email and a password of 6+ characters."], 400);
}

// Is this email already used?
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    send(["error" => "This email is already registered."], 409);
}

// Save the user with a hashed password
$hash = password_hash($pass, PASSWORD_DEFAULT);
$name = mb_substr($name, 0, 100);
$stmt = $conn->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $email, $hash);
if (!$stmt->execute()) {
    send(["error" => "Could not create the account."], 500);
}

session_regenerate_id(true);
$_SESSION["user_id"] = $conn->insert_id;
send(["name" => $name, "email" => $email]);