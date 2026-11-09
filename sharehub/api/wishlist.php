<?php
// wishlist.php - GET: list saved product ids | POST: add or remove one product
require "db.php";

/* ===== GET: ids of the signed-in user's wishlist ===== */
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    if (empty($_SESSION["user_id"])) { send([]); }
    $uid = (int)$_SESSION["user_id"];

    $stmt = $conn->prepare("SELECT product_id FROM wishlist WHERE user_id = ?");
    $stmt->bind_param("i", $uid);
    $stmt->execute();
    $ids = [];
    foreach ($stmt->get_result() as $row) { $ids[] = (int)$row["product_id"]; }
    send($ids);
}

/* ===== POST: if saved -> remove, if not saved -> add ===== */
$uid = need_login();
$pid = (int)(input()["product_id"] ?? 0);

$stmt = $conn->prepare("SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?");
$stmt->bind_param("ii", $uid, $pid);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;

if ($exists) {
    $stmt = $conn->prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?");
} else {
    $stmt = $conn->prepare("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)");
}
$stmt->bind_param("ii", $uid, $pid);
if (!$stmt->execute()) {
    send(["error" => "Could not update the wishlist."], 400);
}
send(["liked" => !$exists]);