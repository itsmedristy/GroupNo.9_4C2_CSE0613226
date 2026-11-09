<?php
// cart.php - GET: list cart items | POST: set the quantity of one product (0 = remove)
require "db.php";

/* ===== GET: the signed-in user's cart ===== */
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    if (empty($_SESSION["user_id"])) { send([]); }
    $uid = (int)$_SESSION["user_id"];

    $stmt = $conn->prepare("SELECT product_id, qty FROM cart_items WHERE user_id = ?");
    $stmt->bind_param("i", $uid);
    $stmt->execute();
    $items = [];
    foreach ($stmt->get_result() as $row) {
        $items[] = ["id" => (int)$row["product_id"], "qty" => (int)$row["qty"]];
    }
    send($items);
}

/* ===== POST: change the quantity ===== */
$uid = need_login();
$d   = input();
$pid = (int)($d["product_id"] ?? 0);
$qty = min(99, (int)($d["qty"] ?? 0));

if ($qty <= 0) {
    $stmt = $conn->prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?");
    $stmt->bind_param("ii", $uid, $pid);
} else {
    // add the row, or update the quantity if the product is already in the cart
    $stmt = $conn->prepare(
        "INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE qty = VALUES(qty)"
    );
    $stmt->bind_param("iii", $uid, $pid, $qty);
}
if (!$stmt->execute()) {
    send(["error" => "Could not update the cart."], 400);
}
send(["ok" => true]);