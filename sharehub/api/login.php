<?php
// login.php - check email + password and start a session
require "db.php";

$d = input();
$email = strtolower(trim($d["email"] ?? ""));
$pass  = $d["password"] ?? "";

$stmt = $conn->prepare("SELECT id, name, email, password FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user || !password_verify($pass, $user["password"])) {
    send(["error" => "Incorrect email or password."], 401);
}

session_regenerate_id(true);
$_SESSION["user_id"] = (int)$user["id"];
send(["name" => $user["name"], "email" => $user["email"]]);