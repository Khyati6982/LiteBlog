import { serverURL } from "./config.js";

// Global variables
let editingPostId = null;      // Tracks edit mode; null means we're creating a new post.
let currentBlogImages = [];    // Stores the blog images of the post being edited

// --- AUTO-FILL TODAY'S DATE & PREVENT PAST AND FUTURE SELECTION ---
document.addEventListener("DOMContentLoaded", function () {
  const dateInput = document.getElementById("date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
    dateInput.setAttribute("min", today); // Prevent past dates
    dateInput.setAttribute("max", today); // Prevent future dates
  }
});

// --- FETCH & RENDER POSTS ---
async function fetchPosts() {
  try {
    const response = await fetch(serverURL);
    const posts = await response.json();
    renderPosts(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
  }
}

function renderPosts(posts) {
  const blogPostsContainer = document.getElementById("blog-posts");
  blogPostsContainer.innerHTML = ""; // Clear previous content

  if (posts.length === 0) {
    blogPostsContainer.innerHTML = `<p class="text-center">No posts found</p>`;
    return;
  }

  posts.forEach((post) => {
    const imagesArray = Array.isArray(post.blogImages) ? post.blogImages : [];

    const profilePicHTML =
      post.profilePicture && post.profilePicture.trim() !== ""
        ? `<img src="${post.profilePicture}" alt="${post.name}'s profile picture" class="profile-pic" />`
        : `<img src="./assets/default-profile.jpg" alt="Default profile picture" class="profile-pic" />`;

    const blogImagesHTML =
      imagesArray.length > 0
        ? imagesArray.map(
            (image) =>
              `<img src="${image}" alt="Blog image for ${post.title}" class="blog-image">`
          ).join("")
        : "";

    // Format date as DD/MM/YYYY and make it bold
    let formattedDate = "<strong>Unknown Date</strong>";
    if (post.date) {
      const [year, month, day] = post.date.split("-");
      formattedDate = `<i>${day}/${month}/${year}</i>`;
    }

    blogPostsContainer.insertAdjacentHTML(
      "afterbegin",
      `
      <div class="blog-post">
        <div class="post-header d-flex align-items-center">
          ${profilePicHTML}
          <div>
            <h3>${post.title}</h3>
            <span class="post-author">By ${post.name}</span>
            <h6 class="post-date text-black mt-1">${formattedDate}</h6>
          </div>
        </div>
        <p>${post.content}</p>
        <div class="blog-images">
          ${blogImagesHTML}
        </div>
        <div class="mt-2">
          <button class="btn btn-warning btn-sm me-2" onclick="editPost('${post.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePost('${post.id}')">Delete</button>
        </div>
      </div>
      `
    );
  });
}

// --- FORM HANDLING ---
document.getElementById("blog-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  // Validate mandatory fields.
  const title = document.getElementById("title").value.trim();
  const name = document.getElementById("name").value.trim();
  const content = document.getElementById("content").value.trim();
  if (!title || !name || !content) {
    alert("Title, Author Name, and Content are required.");
    return;
  }

  // Process profile picture by storing its file path.
  const profilePicInput = document.getElementById("profile-pic");
  let profilePicturePath = "";
  if (profilePicInput.files && profilePicInput.files.length > 0) {
    profilePicturePath = "assets/" + profilePicInput.files[0].name;
  }

  // Build the post object.
  let postData = {
    title,
    name,
    content,
    profilePicture: profilePicturePath,
  };

  if (editingPostId !== null) {
    // In edit mode, retain existing blog images.
    postData.blogImages = currentBlogImages;
  } else {
    // New Post - Generate Sequential ID.
    let newId = 1;
    try {
      const responsePosts = await fetch(serverURL);
      const posts = await responsePosts.json();
      if (posts.length > 0) {
        newId = Math.max(...posts.map((post) => Number(post.id))) + 1;
      }
    } catch (error) {
      console.error("Error fetching posts for ID generation:", error);
    }
    // Force new post ID to a string.
    postData.id = String(newId);

    // Process blog images by storing file paths.
    const imagesInput = document.getElementById("images");
    let blogImagesPaths = [];
    if (imagesInput.files && imagesInput.files.length > 0) {
      console.log("Selected blog images:", Array.from(imagesInput.files));
      blogImagesPaths = Array.from(imagesInput.files).map(file => "assets/" + file.name);
    }
    postData.blogImages = blogImagesPaths;
  }

  // DATE FUNCTIONALITY:
  // Force the date to be today's date.
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("date");
  dateInput.value = today;
  postData.date = today;

  try {
    if (editingPostId !== null) {
      const response = await fetch(`${serverURL}/${editingPostId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error("Failed to update post");
      // Reset edit mode.
      editingPostId = null;
      document.querySelector("#blog-form button[type='submit']").textContent = "Create Blog";
      document.getElementById("images-container").style.display = "block";
      document.getElementById("form-heading").innerText = "Create Blog";
    } else {
      const response = await fetch(serverURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error("Failed to create post");
    }

    document.getElementById("blog-form").reset();
    fetchPosts();

    // For small screens, scroll the window to the top; for larger screens, scroll the blog posts into view.
    if (window.innerWidth < 992) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.getElementById("blog-posts").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    console.error("Error submitting the form:", error);
  }

  // Update form buttons after submission.
  updateFormButtons();
});

// --- DELETE FUNCTION ---
async function deletePost(postId) {
  try {
    const response = await fetch(`${serverURL}/${postId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete post");
    fetchPosts();
  } catch (error) {
    console.error(`Error deleting post ${postId}:`, error);
  }
}

// --- EDIT FUNCTION ---
async function editPost(postId) {
  try {
    const response = await fetch(`${serverURL}/${postId}`);
    if (!response.ok) throw new Error("Failed to fetch post for editing");

    const post = await response.json();

    // Populate form fields with existing post data
    document.getElementById("title").value = post.title;
    document.getElementById("name").value = post.name;
    document.getElementById("content").value = post.content;
    
    // Always update the date to today's date in edit mode.
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("date").value = today;
    post.date = today;

    editingPostId = postId;
    document.querySelector("#blog-form button[type='submit']").textContent = "Update Blog";
    document.getElementById("form-heading").innerText = "Edit Blog";

    // Retain existing blog images during edit, but hide the option to upload new images.
    currentBlogImages = post.blogImages || [];
    document.getElementById("images-container").style.display = "none";

    // For small screens: 
    // - Show the Create Blog section (so the form is visible)
    // - Set the mobile toggle's text to "×" to indicate editing (or cancellation) mode.
    const createBlogSection = document.getElementById("create-blog");
    createBlogSection.style.display = "block";
    if (window.innerWidth < 992) {
      document.getElementById("toggle-create-blog").textContent = "×";
    }
    
    // Scroll the form into view.
    createBlogSection.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (error) {
    console.error("Error fetching post for editing:", error);
  }

  updateFormButtons();
}

// --- CANCEL EDIT FUNCTION ---
function cancelEdit() {
  document.getElementById("blog-form").reset();
  editingPostId = null;
  document.querySelector("#blog-form button[type='submit']").textContent = "Create Blog";
  document.getElementById("images-container").style.display = "block";
  document.getElementById("form-heading").innerText = "Create Blog";
  // Hide Cancel Edit button.
  document.getElementById("cancel-edit").style.display = "none";

  // On small screens, hide the Create Blog section.
  if (window.innerWidth < 992) {
    document.getElementById("create-blog").style.display = "none";
    document.getElementById("toggle-create-blog").textContent = "+";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Update form buttons.
  updateFormButtons();
}

// --- CLEAR BLOG FUNCTION ---
function clearBlogForm() {
  document.getElementById("blog-form").reset();
  editingPostId = null;
  document.querySelector("#blog-form button[type='submit']").textContent = "Create Blog";
  document.getElementById("images-container").style.display = "block";
  document.getElementById("form-heading").innerText = "Create Blog";
  
  // Update form buttons.
  updateFormButtons();
}

// Attach Clear Blog button event listener.
const clearBlogButton = document.getElementById("clear-blog");
if (clearBlogButton) {
  clearBlogButton.addEventListener("click", clearBlogForm);
}

// --- UPDATE FORM BUTTONS FUNCTION ---
function updateFormButtons() {
  const clearBlogButton = document.getElementById("clear-blog");
  const cancelEditButton = document.getElementById("cancel-edit");

  if (window.innerWidth >= 992) {
    if (editingPostId !== null) {  // Update mode.
      cancelEditButton.style.display = "block";
      clearBlogButton.style.display = "none";
    } else {  // Create mode.
      cancelEditButton.style.display = "none";
      clearBlogButton.style.display = "block";
    }
  } else {
    // On small screens, hide both.
    cancelEditButton.style.display = "none";
    clearBlogButton.style.display = "none";
  }
}

// Listen for Cancel Edit button click.
const cancelEditButtonElem = document.getElementById("cancel-edit");
if (cancelEditButtonElem) {
  cancelEditButtonElem.addEventListener("click", cancelEdit);
}

// --- DYNAMIC SEARCH ---
document.getElementById("search-bar").addEventListener("input", async function () {
  const query = this.value.toLowerCase();
  try {
    const response = await fetch(serverURL);
    const posts = await response.json();
    const filteredPosts = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.name.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
    );
    renderPosts(filteredPosts);
  } catch (error) {
    console.error("Error filtering posts:", error);
  }
});

// --- INITIAL FETCH & MOBILE TOGGLE ---
fetchPosts();

document.getElementById("toggle-create-blog").addEventListener("click", function () {
  const createBlogSection = document.getElementById("create-blog");
  if (!createBlogSection.style.display || createBlogSection.style.display === "none") {
    createBlogSection.style.display = "block";
    this.textContent = "×";
    createBlogSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    createBlogSection.style.display = "none";
    this.textContent = "+";
    document.getElementById("blog-form").reset();
    editingPostId = null;
    document.getElementById("form-heading").innerText = "Create Blog";
    document.getElementById("images-container").style.display = "block";
  }
  
  // Always update form buttons after toggling.
  updateFormButtons();
});

// Expose edit, delete, and cancel functions globally.
window.editPost = editPost;
window.deletePost = deletePost;
window.cancelEdit = cancelEdit;

// --- WINDOW RESIZE LISTENER FOR RESPONSIVENESS ---
function updateUIForScreenSize() {
  if (window.innerWidth >= 992) {
    // For larger screens, ensure the Create Blog section is visible and clear the mobile toggle.
    document.getElementById("create-blog").style.display = "block";
    document.getElementById("toggle-create-blog").textContent = "";
  } else {
    // For smaller screens, hide the Create Blog section.
    document.getElementById("create-blog").style.display = "none";
    document.getElementById("toggle-create-blog").textContent = "+";
  }
  // Update the buttons accordingly.
  updateFormButtons();
}

window.addEventListener("resize", updateUIForScreenSize);
// Initial call on load.
updateUIForScreenSize();
