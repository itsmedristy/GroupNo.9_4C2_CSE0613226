<?php
// db.php - database connection + small helper functions used by every API file

session_start();
header("Content-Type: application/json; charset=utf-8");

// Send a JSON answer to the browser and stop
function send($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

// Read the JSON sent by script.js
function input() {
    return json_decode(file_get_contents("php://input"), true) ?? [];
}

// Stop with an error if the visitor is not signed in; returns the user id
function need_login() {
    if (empty($_SESSION["user_id"])) {
        send(["error" => "Please sign in first."], 401);
    }
    return (int)$_SESSION["user_id"];
}

// XAMPP default: user "root", empty password. Change these if you set a password.
mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli("localhost", "root", "", "sharehub");
if ($conn->connect_error) {
    send(["error" => "Database connection failed. Is MySQL running in XAMPP?"], 500);
}
$conn->set_charset("utf8mb4");