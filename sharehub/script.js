/* =====================================================
   ShareHub - script.js (works with the PHP backend)
   Sections: 1 Data | 2 Server helper | 3 Helpers | 4 Products |
   5 Search | 6 Category | 7 Details | 8 Wishlist | 9 Cart |
   10 Login | 11 Register | 12 Account | 13 List product |
   14 Checkout | 15 Modal | 16 Toast | 17 Start
   ===================================================== */


/* ========== 1. DATA: everything now comes from the server ========== */

let products = [];            // from api/products.php
let cart = [];                // [{id, qty}] from api/cart.php
let wishlist = [];            // [id, id, ...] from api/wishlist.php
let user = null;              // {name, email} or null (from api/me.php)

let currentCategory = "All";
let viewMode = "all";         // "all" or "wishlist"
let searchText = "";
let selectedProduct = null;
let pendingBlob = null;       // resized image waiting to be uploaded


/* ========== 2. SERVER HELPER: one function for every request ========== */
/* api("login.php", {...})  -> POST JSON
   api("products.php")      -> GET
   api("products.php", formData) -> POST with file */

async function api(path, body){
  const options = {};
  if(body !== undefined){
    options.method = "POST";
    if(body instanceof FormData){
      options.body = body;
    } else {
      options.headers = {"Content-Type":"application/json"};
      options.body = JSON.stringify(body);
    }
  }
  try {
    const res = await fetch("api/" + path, options);
    const data = await res.json();
    return {ok: res.ok, data};
  } catch(e){
    return {ok:false, data:{error:"Cannot reach the server. Start Apache + MySQL in XAMPP and open http://localhost/sharehub/"}};
  }
}

// Load everything from the server and redraw the page
async function loadAll(){
  const me = await api("me.php");
  user = me.ok ? me.data.user : null;

  const p = await api("products.php");
  products = p.ok ? p.data : [];
  if(!p.ok) showToast(p.data.error);

  const w = await api("wishlist.php");
  wishlist = w.ok ? w.data : [];

  const c = await api("cart.php");
  cart = c.ok ? c.data : [];

  renderProducts();
  updateCart();
  updateWishlistCount();
  updateAccount();
}


/* ========== 3. HELPERS: safe text, price and type labels ========== */

// Stops users from injecting HTML/JS through names and descriptions (XSS)
function esc(text){
  return String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function priceText(p){
  return (p.type === "Sell" || p.type === "Rent") ? "৳" + p.price.toLocaleString() : "FREE";
}

function typeLabel(p){
  if(p.type === "Sell") return "FOR SALE";
  if(p.type === "Rent") return "FOR RENT • " + p.period;
  if(p.type === "Share") return "FREE TO SHARE";
  return "BORROW • " + p.period;
}

function badgeText(p){
  return {Sell:"Sale", Rent:"Rent", Share:"Share", Borrow:"Borrow"}[p.type];
}

// Shows a number on a header badge and hides it when it is 0
function setBadge(id, n){
  const el = document.getElementById(id);
  el.textContent = n;
  el.classList.toggle("hide", n === 0);
}

// Returns true if signed in, otherwise opens the login window
function requireLogin(){
  if(user) return true;
  showToast("Please sign in first.");
  openModal("loginModal");
  return false;
}


/* ========== 4. PRODUCTS: build cards and show the grid ========== */

function createProductCard(p){
  const liked = wishlist.includes(p.id);
  const card = document.createElement("article");
  card.className = "productCard";
  card.dataset.id = p.id;
  card.innerHTML = `
    <div class="productImage">
      <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">
      <span class="productBadge">${badgeText(p)}</span>
      <button class="wishlistBtn ${liked ? "active" : ""}" data-action="wishlist" aria-label="Wishlist">${liked ? "♥" : "♡"}</button>
    </div>
    <div class="productBody">
      <div class="productCategory">${esc(p.category)}</div>
      <h3>${esc(p.name)}</h3>
      <p class="productDescription">${esc(p.description)}</p>
      <div class="productBottom">
        <span class="productPrice">${priceText(p)}</span>
        <span class="productRating">★ ${p.rating || 5}</span>
      </div>
      <div class="productLocation">📍 ${esc(p.location)}</div>
      <span class="productType type-${p.type}">${typeLabel(p)}</span>
      <button class="addCartBtn" data-action="cart">🛒 Add to Cart</button>
    </div>`;
  return card;
}

function renderProducts(){
  let list = viewMode === "wishlist" ? products.filter(p => wishlist.includes(p.id)) : [...products];

  if(currentCategory !== "All") list = list.filter(p => p.category === currentCategory);

  if(searchText){
    const t = searchText.toLowerCase();
    list = list.filter(p => [p.name, p.category, p.location, p.type, p.description].join(" ").toLowerCase().includes(t));
  }

  const sort = document.getElementById("sortSelect").value;
  if(sort === "low") list.sort((a,b) => a.price - b.price);
  if(sort === "high") list.sort((a,b) => b.price - a.price);

  document.getElementById("productHeading").textContent =
    viewMode === "wishlist" ? "My Wishlist" : (currentCategory === "All" ? "Discover Products" : currentCategory);

  const grid = document.getElementById("productsGrid");
  const empty = document.getElementById("emptyState");
  grid.innerHTML = "";
  updateStats();

  if(list.length === 0){
    empty.style.display = "block";
    document.getElementById("resultText").textContent = "No matching products were found.";
    return;
  }
  empty.style.display = "none";
  document.getElementById("resultText").textContent = `${list.length} product${list.length > 1 ? "s" : ""} available`;
  list.forEach(p => grid.appendChild(createProductCard(p)));
}

// One click handler for all cards (card, wishlist heart, add to cart)
document.getElementById("productsGrid").addEventListener("click", function(e){
  const card = e.target.closest(".productCard");
  if(!card) return;
  const id = Number(card.dataset.id);
  const action = e.target.closest("[data-action]");
  if(action && action.dataset.action === "wishlist") return toggleWishlist(id);
  if(action && action.dataset.action === "cart") return addToCart(id);
  openProductDetails(id);
});

// Real numbers in the hero card
function updateStats(){
  document.getElementById("statListings").textContent = products.length;
  document.getElementById("statRent").textContent = products.filter(p => p.type === "Rent").length;
  document.getElementById("statFree").textContent = products.filter(p => p.type === "Share" || p.type === "Borrow").length;
}


/* ========== 5. SEARCH ========== */

function searchProducts(){
  searchText = document.getElementById("searchInput").value.trim();
  renderProducts();
  scrollToProducts();
}

document.getElementById("searchInput").addEventListener("input", function(){
  searchText = this.value.trim();
  renderProducts();
});

document.getElementById("searchInput").addEventListener("keydown", function(e){
  if(e.key === "Enter") searchProducts();
});

function scrollToProducts(){
  document.getElementById("products").scrollIntoView({behavior:"smooth"});
}


/* ========== 6. CATEGORY: filter buttons ========== */

function filterCategory(category){
  currentCategory = category;
  viewMode = "all";
  document.querySelectorAll("#categories button").forEach(b => {
    b.classList.toggle("active", b.dataset.cat === category);
  });
  renderProducts();
  scrollToProducts();
}

document.getElementById("categories").addEventListener("click", function(e){
  const btn = e.target.closest("button");
  if(btn) filterCategory(btn.dataset.cat);
});


/* ========== 7. PRODUCT DETAILS MODAL ========== */

function openProductDetails(id){
  const p = products.find(x => x.id === id);
  if(!p) return;
  selectedProduct = p;

  document.getElementById("detailsImage").src = p.image;
  document.getElementById("detailsImage").alt = p.name;
  document.getElementById("detailsCategory").textContent = p.category;
  document.getElementById("detailsName").textContent = p.name;
  document.getElementById("detailsRating").textContent = p.rating || 5;
  document.getElementById("detailsPrice").textContent = priceText(p);
  document.getElementById("detailsType").textContent = typeLabel(p);
  document.getElementById("detailsLocation").textContent = p.location;
  document.getElementById("detailsOwner").textContent = p.owner || "Community Member";
  document.getElementById("detailsDescription").textContent = p.description;

  updateDetailsWishlistButton();
  openModal("detailsModal");
}

// Opens WhatsApp chat with the owner (only signed-in users get the number)
function contactSeller(){
  if(!selectedProduct) return;
  if(!user){ requireLogin(); return; }
  let digits = (selectedProduct.phone || "").replace(/\D/g, "");
  if(!digits){ showToast("This listing has no contact number."); return; }
  if(digits.startsWith("0")) digits = "88" + digits;   // Bangladesh country code
  const msg = encodeURIComponent("Hi, I am interested in: " + selectedProduct.name);
  window.open(`https://wa.me/${digits}?text=${msg}`, "_blank", "noopener");
}

function updateDetailsWishlistButton(){
  if(!selectedProduct) return;
  const btn = document.getElementById("detailsWishlist");
  const liked = wishlist.includes(selectedProduct.id);
  btn.classList.toggle("active", liked);
  btn.textContent = liked ? "♥ Remove from Wishlist" : "♡ Add to Wishlist";
}

function wishlistFromDetails(){
  if(selectedProduct) toggleWishlist(selectedProduct.id);
}

function cartFromDetails(){
  if(selectedProduct) addToCart(selectedProduct.id);
}


/* ========== 8. WISHLIST (saved in the database) ========== */

async function toggleWishlist(id){
  if(!requireLogin()) return;
  const r = await api("wishlist.php", {product_id:id});
  if(!r.ok){ showToast(r.data.error); return; }

  if(r.data.liked){
    wishlist.push(id);
    showToast("Added to wishlist ♥");
  } else {
    wishlist = wishlist.filter(x => x !== id);
    showToast("Removed from wishlist.");
  }
  updateWishlistCount();
  renderProducts();
  updateDetailsWishlistButton();
}

function updateWishlistCount(){
  setBadge("wishlistCount", wishlist.length);
}

function showWishlist(){
  if(!requireLogin()) return;
  if(wishlist.length === 0){ showToast("Your wishlist is empty."); return; }
  viewMode = "wishlist";
  currentCategory = "All";
  searchText = "";
  document.getElementById("searchInput").value = "";
  document.querySelectorAll("#categories button").forEach(b => b.classList.toggle("active", b.dataset.cat === "All"));
  renderProducts();
  scrollToProducts();
}


/* ========== 9. CART (saved in the database) ========== */

// Sends the new quantity to the server (0 removes the item)
async function setQty(id, qty){
  const r = await api("cart.php", {product_id:id, qty});
  if(!r.ok){ showToast(r.data.error); return false; }
  const item = cart.find(c => c.id === id);
  if(qty <= 0) cart = cart.filter(c => c.id !== id);
  else if(item) item.qty = qty;
  else cart.push({id, qty});
  updateCart();
  return true;
}

async function addToCart(id){
  if(!requireLogin()) return;
  const item = cart.find(c => c.id === id);
  if(await setQty(id, item ? item.qty + 1 : 1)) showToast("Product added to cart.");
}

function changeQty(id, change){
  const item = cart.find(c => c.id === id);
  if(item) setQty(id, item.qty + change);
}

async function removeFromCart(id){
  if(await setQty(id, 0)) showToast("Removed from cart.");
}

function updateCart(){
  cart = cart.filter(c => products.some(p => p.id === c.id));
  setBadge("cartCount", cart.reduce((s,c) => s + c.qty, 0));

  const box = document.getElementById("cartItems");
  box.innerHTML = "";

  if(cart.length === 0){
    box.innerHTML = `<div class="emptyState" style="display:block"><div>🛒</div><h3>Your cart is empty</h3><p>Add products to see them here.</p></div>`;
    document.getElementById("cartTotal").textContent = "৳0";
    return;
  }

  let total = 0;
  cart.forEach(c => {
    const p = products.find(x => x.id === c.id);
    total += p.price * c.qty;
    // Rent items: quantity means number of days/weeks/months
    const unit = p.type === "Rent" ? " × " + c.qty + " (" + p.period.replace("Per ","") + ")" : " × " + c.qty;
    const row = document.createElement("div");
    row.className = "cartItem";
    row.innerHTML = `
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div class="cartItemInfo">
        <h4>${esc(p.name)}</h4>
        <p>${priceText(p)}${unit}</p>
        <p>${typeLabel(p)}</p>
        <div class="qtyRow">
          <button onclick="changeQty(${p.id},-1)" aria-label="Decrease">−</button>
          <span>${c.qty}</span>
          <button onclick="changeQty(${p.id},1)" aria-label="Increase">+</button>
        </div>
      </div>
      <button class="removeCart" onclick="removeFromCart(${p.id})" aria-label="Remove">×</button>`;
    box.appendChild(row);
  });
  document.getElementById("cartTotal").textContent = "৳" + total.toLocaleString();
}

function openCart(){
  updateCart();
  document.getElementById("cartPanel").classList.add("open");
  document.getElementById("cartOverlay").classList.add("show");
  document.body.classList.add("lock");
}

function closeCart(){
  document.getElementById("cartPanel").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("show");
  document.body.classList.remove("lock");
}


/* ========== 10. LOGIN (api/login.php) ========== */

async function login(event){
  event.preventDefault();
  const form = event.target;
  const r = await api("login.php", {
    email: document.getElementById("loginEmail").value,
    password: document.getElementById("loginPassword").value
  });
  if(!r.ok){ showToast(r.data.error); return; }

  form.reset();
  closeModal("loginModal");
  await loadAll();
  showToast("Welcome back, " + r.data.name + "!");
}


/* ========== 11. REGISTER (api/register.php) ========== */

async function register(event){
  event.preventDefault();
  const form = event.target;
  const password = document.getElementById("regPassword").value;

  if(password !== document.getElementById("regConfirm").value){
    showToast("Passwords do not match.");
    return;
  }

  const r = await api("register.php", {
    name: document.getElementById("regName").value,
    email: document.getElementById("regEmail").value,
    password
  });
  if(!r.ok){ showToast(r.data.error); return; }

  form.reset();
  closeModal("registerModal");
  await loadAll();
  showToast("Account created successfully!");
}


/* ========== 12. ACCOUNT BUTTON (Sign In / name / logout) ========== */

function updateAccount(){
      document.getElementById("registerBtn").style.display = user ? "none" : "";
  const btn = document.getElementById("accountBtn");

  if(!user){
    btn.textContent = "Sign In";
    btn.onclick = () => openModal("loginModal");
    return;
  }

  btn.textContent = user.name;
  btn.onclick = async function(){
    if(!confirm("Do you want to log out?")) return;
    await api("logout.php", {});
    viewMode = "all";
    await loadAll();
    showToast("You have been logged out.");
  };
}


/* ========== 13. LIST A PRODUCT (sell / rent / share / borrow) ========== */

function sellProduct(){
  if(requireLogin()) openModal("sellModal");
}

// Shows or hides price / rent period / borrow days depending on the type
function changeProductType(){
  const type = document.getElementById("productType").value;
  const price = document.getElementById("productPrice");
  const paid = (type === "Sell" || type === "Rent");

  document.getElementById("priceContainer").style.display = paid ? "block" : "none";
  document.getElementById("rentContainer").style.display = type === "Rent" ? "block" : "none";
  document.getElementById("borrowContainer").style.display = type === "Borrow" ? "block" : "none";
  price.required = paid;
  if(!paid) price.value = "";
}

// Shrinks the chosen image before upload (faster upload, smaller files)
document.getElementById("productImage").addEventListener("change", function(){
  const file = this.files[0];
  pendingBlob = null;
  if(!file) return;
  if(file.size > 5 * 1024 * 1024){
    showToast("Image is too large (max 5MB).");
    this.value = "";
    document.getElementById("imagePreview").innerHTML = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const scale = Math.min(1, 1000 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => { pendingBlob = blob; }, "image/jpeg", 0.8);
      document.getElementById("imagePreview").innerHTML = `<img src="${canvas.toDataURL("image/jpeg", 0.6)}" alt="Preview">`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

async function addProduct(event){
  event.preventDefault();
  if(!requireLogin()){ closeModal("sellModal"); return; }

  const form = event.target;
  const type = document.getElementById("productType").value;
  const price = Number(document.getElementById("productPrice").value) || 0;

  if((type === "Sell" || type === "Rent") && price <= 0){ showToast("Please enter a valid price."); return; }
  if(!pendingBlob){ showToast("Please select an image and wait for the preview."); return; }

  let period = "";
  if(type === "Rent") period = document.getElementById("rentPeriod").value;
  if(type === "Borrow") period = (document.getElementById("borrowDays").value || 7) + " days";

  // FormData is used because we send a file together with the text
  const data = new FormData();
  data.append("name", document.getElementById("productName").value);
  data.append("category", document.getElementById("productCategory").value);
  data.append("type", type);
  data.append("price", price);
  data.append("period", period);
  data.append("location", document.getElementById("productLocation").value);
  data.append("phone", document.getElementById("productPhone").value);
  data.append("description", document.getElementById("productDescription").value);
  data.append("image", pendingBlob, "photo.jpg");

  const r = await api("products.php", data);
  if(!r.ok){ showToast(r.data.error); return; }

  form.reset();
  pendingBlob = null;
  document.getElementById("imagePreview").innerHTML = "";
  changeProductType();
  closeModal("sellModal");
  currentCategory = "All";
  viewMode = "all";
  await loadAll();
  showToast("Your product has been published!");
  scrollToProducts();
}


/* ========== 14. CHECKOUT ========== */

function checkout(){
  if(cart.length === 0){ showToast("Your cart is empty."); return; }
  // No payment system yet: buyers contact each owner from the product page.
  showToast("Open each product and tap Contact Seller to finish.");
}


/* ========== 15. MODAL: open, close, switch ========== */

function openModal(id){
  document.getElementById(id).classList.add("show");
  document.body.classList.add("lock");
}

function closeModal(id){
  document.getElementById(id).classList.remove("show");
  if(!document.querySelector(".modal.show")) document.body.classList.remove("lock");
}

function switchModal(from, to){
  closeModal(from);
  openModal(to);
}

// Click on the dark background closes the modal
document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", e => { if(e.target === modal) closeModal(modal.id); });
});

// Esc key closes any open modal and the cart
document.addEventListener("keydown", e => {
  if(e.key !== "Escape") return;
  document.querySelectorAll(".modal.show").forEach(m => closeModal(m.id));
  closeCart();
});


/* ========== 16. TOAST: small message at the bottom ========== */

function showToast(message){
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}


/* ========== 17. START: run when the page opens ========== */

changeProductType();
loadAll();