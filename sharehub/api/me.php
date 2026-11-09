<?php
// me.php - tells script.js who is signed in (runs every time the page opens)
require "db.php";

if (empty($_SESSION["user_id"])) {
    send(["user" => null]);
}

$id = (int)$_SESSION["user_id"];
$stmt = $conn->prepare("SELECT name, email FROM users WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

send(["user" => $user ?: null]);