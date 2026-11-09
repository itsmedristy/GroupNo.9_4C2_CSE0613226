<?php
// products.php - GET: list all products | POST: add a new product (with image upload)
require "db.php";

/* ===== GET: send all products ===== */
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $loggedIn = !empty($_SESSION["user_id"]);
    $res = $conn->query(
        "SELECT p.*, COALESCE(u.name, 'Community Member') AS owner
         FROM products p LEFT JOIN users u ON u.id = p.user_id
         ORDER BY p.id DESC"
    );

    $list = [];
    while ($r = $res->fetch_assoc()) {
        // Demo products keep a full web link, uploaded ones are files in /uploads
        $image = (strpos($r["image"], "http") === 0) ? $r["image"] : "uploads/" . $r["image"];
        $list[] = [
            "id"          => (int)$r["id"],
            "name"        => $r["name"],
            "category"    => $r["category"],
            "type"        => $r["type"],
            "price"       => (int)$r["price"],
            "period"      => $r["period"],
            "location"    => $r["location"],
            "description" => $r["description"],
            "image"       => $image,
            "rating"      => (float)$r["rating"],
            "owner"       => $r["owner"],
            "phone"       => $loggedIn ? $r["phone"] : ""   // phone is visible only to signed-in users
        ];
    }
    send($list);
}

/* ===== POST: add a product ===== */
$userId = need_login();

$name     = mb_substr(trim($_POST["name"] ?? ""), 0, 100);
$category = $_POST["category"] ?? "";
$type     = $_POST["type"] ?? "";
$price    = (int)($_POST["price"] ?? 0);
$period   = mb_substr(trim($_POST["period"] ?? ""), 0, 30);
$location = mb_substr(trim($_POST["location"] ?? ""), 0, 100);
$desc     = trim($_POST["description"] ?? "");
$phone    = mb_substr(trim($_POST["phone"] ?? ""), 0, 20);

$categories = ["Electronics","Fashion","Home","Sports","Tools","Books","Gaming","Camera","Bicycle"];
$types = ["Sell","Rent","Share","Borrow"];

if ($name === "" || $location === "" || $desc === "" || $phone === ""
    || !in_array($category, $categories) || !in_array($type, $types)) {
    send(["error" => "Please fill in all fields."], 400);
}
if (($type === "Sell" || $type === "Rent") && $price <= 0) {
    send(["error" => "Please enter a valid price."], 400);
}
if ($type === "Share" || $type === "Borrow") { $price = 0; }

/* ----- Image upload ----- */
if (!isset($_FILES["image"]) || $_FILES["image"]["error"] !== UPLOAD_ERR_OK) {
    send(["error" => "Please upload an image."], 400);
}
$file = $_FILES["image"];
if ($file["size"] > 5 * 1024 * 1024) {
    send(["error" => "Image is too large (max 5MB)."], 400);
}
$info = getimagesize($file["tmp_name"]);   // real check that the file is an image
$allowed = ["image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp", "image/gif" => "gif"];
if (!$info || !isset($allowed[$info["mime"]])) {
    send(["error" => "Only JPG, PNG, WEBP or GIF images are allowed."], 400);
}
$fileName = bin2hex(random_bytes(8)) . "." . $allowed[$info["mime"]];
$folder = dirname(__DIR__) . "/uploads/";
if (!is_dir($folder)) { mkdir($folder, 0755, true); }
if (!move_uploaded_file($file["tmp_name"], $folder . $fileName)) {
    send(["error" => "Could not save the image."], 500);
}

/* ----- Save in database ----- */
$stmt = $conn->prepare(
    "INSERT INTO products (user_id, name, category, type, price, period, location, description, image, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
$stmt->bind_param("isssisssss", $userId, $name, $category, $type, $price, $period, $location, $desc, $fileName, $phone);
if (!$stmt->execute()) {
    send(["error" => "Could not save the product."], 500);
}
send(["id" => $conn->insert_id]);