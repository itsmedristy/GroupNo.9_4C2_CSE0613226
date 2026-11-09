<?php
// logout.php - end the session
require "db.php";

$_SESSION = [];
session_destroy();
send(["ok" => true]);