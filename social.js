"use strict";

(() => {
  const client = nohaSupabase;
  const mediaBucket = "noha-media";

  const $social = (selector, root = document) =>
    root.querySelector(selector);

  const $$social = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const state = {
    user: null,
    profile: null,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    moments: [],
    activeMomentId: null,
    momentScope: "friends",
    momentFilterUserId: null,
    activeFriendId: null,
    pendingMomentBlob: null,
    pendingMomentPreviewUrl: "",
    pendingMessageBlob: null,
    pendingMessagePreviewUrl: "",
    signedUrls: new Map(),
    realtimeChannel: null,
    refreshTimer: 0
  };

  const profileDialog =
    $social("#profileDialog");

  const momentComposerDialog =
    $social("#momentComposerDialog");

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initials(name = "NoHa") {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("")
      .toLocaleUpperCase("vi") || "NH";
  }

  function timeAgo(value) {
    const timestamp = new Date(value).getTime();
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - timestamp) / 1000)
    );

    if (seconds < 60) return "Vừa xong";
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} phút trước`;
    }
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} giờ trước`;
    }
    if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)} ngày trước`;
    }

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(value));
  }

  function explainError(error) {
    const message = error?.message || "Đã xảy ra lỗi.";

    if (
      error?.code === "42P01" ||
      message.includes("schema cache") ||
      message.includes("does not exist")
    ) {
      return "Chưa có dữ liệu NoHa Social. Hãy chạy file supabase-setup.sql trước.";
    }

    if (error?.code === "23505") {
      return "Thông tin này đã tồn tại.";
    }

    if (message.includes("row-level security")) {
      return "Tài khoản chưa có quyền thực hiện thao tác này.";
    }

    if (message.includes("Bucket not found")) {
      return "Chưa có kho ảnh NoHa. Hãy chạy file supabase-setup.sql.";
    }

    return message;
  }

  function setText(selector, value) {
    const element = $social(selector);
    if (element) element.textContent = value;
  }

  function setProfileStatus(message, isError = false) {
    const element = $social("#profileStatus");
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "#b42318" : "#6941c6";
  }

  function setComposerStatus(message, isError = false) {
    const element = $social("#momentComposerStatus");
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "#b42318" : "#6941c6";
  }

  function setSocialBusy(isBusy) {
    $$social(
      "#profileDialog button, #momentComposerDialog button"
    ).forEach(button => {
      button.disabled = isBusy;
    });
  }

  async function refreshSession() {
    const { data, error } =
      await client.auth.getSession();

    if (error) throw error;

    state.user = data.session?.user || null;
    return state.user;
  }

  async function requireUser(action) {
    try {
      await refreshSession();
    } catch (error) {
      showToast(explainError(error));
    }

    if (state.user) return true;

    showAccountGate(action);
    return false;
  }

  function clearPrivateState() {
    state.user = null;
    state.profile = null;
    state.friends = [];
    state.incomingRequests = [];
    state.outgoingRequests = [];
    state.moments = [];
    state.activeMomentId = null;
    state.momentScope = "friends";
    state.momentFilterUserId = null;
    state.activeFriendId = null;
    state.signedUrls.clear();

    if (state.realtimeChannel) {
      client.removeChannel(state.realtimeChannel);
      state.realtimeChannel = null;
    }

    setHeaderIdentity();
    renderFriendSurfaces();
    renderNoMoments();
    renderMessagesEmpty();
  }

  function setHeaderIdentity() {
    const name =
      state.profile?.username || "NoHa";

    const mark =
      $social("#headerProfileButton span");

    if (mark) mark.textContent = initials(name);

    const headerButton =
      $social("#headerProfileButton");

    if (headerButton) {
      headerButton.title = state.user
        ? `Tài khoản ${name}`
        : "Đăng nhập NoHa";
    }
  }

  async function loadProfile() {
    if (!state.user) return;

    const { data, error } = await client
      .from("profiles")
      .select("id, username, avatar_url, created_at")
      .eq("id", state.user.id)
      .maybeSingle();

    if (error) throw error;

    state.profile = data;
    setHeaderIdentity();

    if ($social("#profileUsernameInput")) {
      $social("#profileUsernameInput").value =
        data?.username || "";
    }

    setText("#profileEmail", state.user.email || "");
  }

  async function loadFriends() {
    if (!state.user) return;

    const { data, error } = await client
      .from("friendships")
      .select(
        "id, requester_id, addressee_id, status, created_at"
      )
      .or(
        `requester_id.eq.${state.user.id},addressee_id.eq.${state.user.id}`
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const otherIds = [...new Set(
      rows.map(row =>
        row.requester_id === state.user.id
          ? row.addressee_id
          : row.requester_id
      )
    )];

    let profiles = [];

    if (otherIds.length) {
      const response = await client
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherIds);

      if (response.error) throw response.error;
      profiles = response.data || [];
    }

    const profileMap = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    state.friends = rows
      .filter(row => row.status === "accepted")
      .map(row => {
        const id = row.requester_id === state.user.id
          ? row.addressee_id
          : row.requester_id;

        return {
          friendshipId: row.id,
          ...profileMap.get(id)
        };
      })
      .filter(friend => friend.id);

    state.incomingRequests = rows
      .filter(row =>
        row.status === "pending" &&
        row.addressee_id === state.user.id
      )
      .map(row => ({
        ...row,
        profile: profileMap.get(row.requester_id)
      }));

    state.outgoingRequests = rows
      .filter(row =>
        row.status === "pending" &&
        row.requester_id === state.user.id
      )
      .map(row => ({
        ...row,
        profile: profileMap.get(row.addressee_id)
      }));

    renderFriendSurfaces();
  }

  function friendCard(profile, actionHtml = "") {
    profile = profile || {
      id: "",
      username: "Người dùng NoHa"
    };

    return `
      <article class="friend-manager-item" data-user-id="${
        escapeHtml(profile.id)
      }">
        <span class="social-avatar">${
          escapeHtml(initials(profile.username))
        }</span>
        <div>
          <strong>${escapeHtml(profile.username)}</strong>
          <small>@${escapeHtml(profile.username)}</small>
        </div>
        ${actionHtml}
      </article>
    `;
  }

  function renderFriendSurfaces() {
    const friendList =
      $social("#profileFriendList");

    if (friendList) {
      friendList.innerHTML = state.friends.length
        ? state.friends.map(friend => friendCard(
            friend,
            `<button class="danger-link remove-friend-button" type="button" data-friendship-id="${
              escapeHtml(friend.friendshipId)
            }">Xóa</button>`
          )).join("")
        : '<p class="social-empty">Chưa có bạn bè.</p>';
    }

    const requestList =
      $social("#friendRequestList");

    if (requestList) {
      requestList.innerHTML = state.incomingRequests.length
        ? state.incomingRequests.map(request => friendCard(
            request.profile,
            `<span class="friend-request-actions">
              <button class="primary-button accept-friend-button" type="button" data-request-id="${
                escapeHtml(request.id)
              }">Đồng ý</button>
              <button class="secondary-button reject-friend-button" type="button" data-request-id="${
                escapeHtml(request.id)
              }">Xóa</button>
            </span>`
          )).join("")
        : '<p class="social-empty">Không có lời mời mới.</p>';
    }

    renderMomentFriendList();
    renderMessageFriends();
    bindFriendActionButtons();
  }

  function bindFriendActionButtons() {
    $$social(".accept-friend-button")
      .forEach(button => {
        button.addEventListener("click", () =>
          acceptFriendRequest(button.dataset.requestId)
        );
      });

    $$social(".reject-friend-button")
      .forEach(button => {
        button.addEventListener("click", () =>
          deleteFriendship(button.dataset.requestId)
        );
      });

    $$social(".remove-friend-button")
      .forEach(button => {
        button.addEventListener("click", () =>
          deleteFriendship(button.dataset.friendshipId)
        );
      });

    $$social(".send-friend-request-button")
      .forEach(button => {
        button.addEventListener("click", () =>
          sendFriendRequest(button.dataset.userId)
        );
      });
  }

  async function searchProfiles(query) {
    const results =
      $social("#friendSearchResults");

    results.innerHTML =
      '<p class="social-empty">Đang tìm…</p>';

    const { data, error } = await client
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${query}%`)
      .neq("id", state.user.id)
      .limit(20);

    if (error) throw error;

    const relationIds = new Set([
      ...state.friends.map(friend => friend.id),
      ...state.incomingRequests.map(item => item.requester_id),
      ...state.outgoingRequests.map(item => item.addressee_id)
    ]);

    results.innerHTML = data?.length
      ? data.map(profile => {
          let action = "";

          if (state.friends.some(friend => friend.id === profile.id)) {
            action = '<small class="friend-state">Đã là bạn</small>';
          } else if (relationIds.has(profile.id)) {
            action = '<small class="friend-state">Đang chờ</small>';
          } else {
            action = `<button class="secondary-button send-friend-request-button" type="button" data-user-id="${
              escapeHtml(profile.id)
            }">Kết bạn</button>`;
          }

          return friendCard(profile, action);
        }).join("")
      : '<p class="social-empty">Không tìm thấy tài khoản phù hợp.</p>';

    bindFriendActionButtons();
  }

  async function sendFriendRequest(userId) {
    setProfileStatus("Đang gửi lời mời…");

    const { error } = await client
      .from("friendships")
      .insert({
        requester_id: state.user.id,
        addressee_id: userId,
        status: "pending"
      });

    if (error) {
      setProfileStatus(explainError(error), true);
      return;
    }

    setProfileStatus("Đã gửi lời mời kết bạn.");
    $social("#friendSearchResults").innerHTML = "";
    await loadFriends();
  }

  async function acceptFriendRequest(requestId) {
    const { error } = await client
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) {
      setProfileStatus(explainError(error), true);
      return;
    }

    setProfileStatus("Đã thêm bạn mới.");
    await loadFriends();
  }

  async function deleteFriendship(friendshipId) {
    const { error } = await client
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) {
      setProfileStatus(explainError(error), true);
      return;
    }

    setProfileStatus("Đã cập nhật danh sách bạn bè.");
    await loadFriends();
  }

  async function saveProfile(event) {
    event.preventDefault();

    const input =
      $social("#profileUsernameInput");

    if (!input.reportValidity()) return;

    setSocialBusy(true);
    setProfileStatus("Đang lưu hồ sơ…");

    try {
      const { data, error } = await client
        .from("profiles")
        .update({ username: input.value.trim() })
        .eq("id", state.user.id)
        .select("id, username, avatar_url")
        .single();

      if (error) throw error;

      state.profile = data;
      setHeaderIdentity();
      setProfileStatus("Đã lưu hồ sơ.");
    } catch (error) {
      setProfileStatus(explainError(error), true);
    } finally {
      setSocialBusy(false);
    }
  }

  async function openProfile() {
    if (!(await requireUser("profile"))) return;

    try {
      await Promise.all([loadProfile(), loadFriends()]);
      setProfileStatus("");
      if (!profileDialog.open) profileDialog.showModal();
    } catch (error) {
      showToast(explainError(error));
    }
  }

  async function signOut() {
    const { error } = await client.auth.signOut();

    if (error) {
      setProfileStatus(explainError(error), true);
      return;
    }

    profileDialog.close();
    clearPrivateState();
    openCaptureScreen();
    showToast("Đã đăng xuất NoHa.");
  }

  async function signedUrl(path) {
    if (!path) return "";

    const cached = state.signedUrls.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    const { data, error } = await client.storage
      .from(mediaBucket)
      .createSignedUrl(path, 3600);

    if (error) throw error;

    state.signedUrls.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + 50 * 60 * 1000
    });

    return data.signedUrl;
  }

  async function uploadBlob(blob, category) {
    if (!state.user) throw new Error("Bạn cần đăng nhập.");

    if (blob.size > 10 * 1024 * 1024) {
      throw new Error("Ảnh cần nhỏ hơn 10 MB.");
    }

    const mimeType = blob.type || "image/jpeg";
    const extension = mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : "jpg";

    const path = `${state.user.id}/${category}/${
      crypto.randomUUID()
    }.${extension}`;

    const { error } = await client.storage
      .from(mediaBucket)
      .upload(path, blob, {
        contentType: mimeType,
        upsert: false
      });

    if (error) throw error;
    return path;
  }

  async function sourceToBlob(source) {
    if (source instanceof Blob) return source;

    const response = await fetch(source);
    return response.blob();
  }

  function openMomentComposer(source) {
    state.pendingMomentBlob =
      source instanceof Blob ? source : null;

    if (state.pendingMomentPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.pendingMomentPreviewUrl);
    }

    state.pendingMomentPreviewUrl = source instanceof Blob
      ? URL.createObjectURL(source)
      : source;

    $social("#momentComposerPreview").src =
      state.pendingMomentPreviewUrl;

    $social("#momentCaptionInput").value = "";
    setComposerStatus("");

    if (!momentComposerDialog.open) {
      momentComposerDialog.showModal();
    }
  }

  function closeMomentComposer() {
    momentComposerDialog.close();

    if (state.pendingMomentPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.pendingMomentPreviewUrl);
    }

    state.pendingMomentBlob = null;
    state.pendingMomentPreviewUrl = "";
  }

  async function publishMoment(event) {
    event.preventDefault();

    if (!state.pendingMomentPreviewUrl) {
      setComposerStatus("Hãy chọn một ảnh để đăng.", true);
      return;
    }

    setSocialBusy(true);
    setComposerStatus("Đang đăng Khoảnh Khắc…");

    try {
      const blob = state.pendingMomentBlob ||
        await sourceToBlob(state.pendingMomentPreviewUrl);

      const imagePath =
        await uploadBlob(blob, "moments");

      const { error } = await client
        .from("moments")
        .insert({
          user_id: state.user.id,
          image_path: imagePath,
          caption: $social("#momentCaptionInput")
            .value.trim()
        });

      if (error) throw error;

      closeMomentComposer();
      state.momentScope = "mine";
      state.momentFilterUserId = null;
      syncMomentScopeTabs();
      openSocialScreen("moments");
      await loadMoments();
      showToast("Đã đăng Khoảnh Khắc.");
    } catch (error) {
      setComposerStatus(explainError(error), true);
    } finally {
      setSocialBusy(false);
    }
  }

  async function loadMoments() {
    if (!state.user) return;

    const { data, error } = await client
      .from("moments")
      .select("id, user_id, image_path, caption, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const moments = data || [];
    const userIds = [...new Set(
      moments.map(moment => moment.user_id)
    )];

    let profiles = [];

    if (userIds.length) {
      const response = await client
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (response.error) throw response.error;
      profiles = response.data || [];
    }

    const profileMap = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    state.moments = moments.map(moment => ({
      ...moment,
      profile: profileMap.get(moment.user_id) || {
        id: moment.user_id,
        username: "Người dùng NoHa"
      }
    }));

    if (
      !state.activeMomentId ||
      !state.moments.some(moment =>
        moment.id === state.activeMomentId
      )
    ) {
      state.activeMomentId = state.moments[0]?.id || null;
    }

    renderMomentFriendList();
    await renderActiveMoment();
  }

  function syncMomentScopeTabs() {
    $$social("[data-moment-scope]")
      .forEach(tab => {
        const active =
          tab.dataset.momentScope === state.momentScope;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
  }

  function filteredMoments() {
    const scopedMoments = state.moments.filter(moment =>
      state.momentScope === "mine"
        ? moment.user_id === state.user?.id
        : moment.user_id !== state.user?.id
    );

    return state.momentFilterUserId
      ? scopedMoments.filter(moment =>
          moment.user_id === state.momentFilterUserId
        )
      : scopedMoments;
  }

  function renderMomentFriendList() {
    const list = $social(".moment-friend-list");
    if (!list) return;

    const owners = [];
    const seen = new Set();

    filteredMoments().forEach(moment => {
      if (seen.has(moment.user_id)) return;
      seen.add(moment.user_id);
      owners.push(moment);
    });

    const allButton = `
      <button class="moment-friend ${
        state.momentFilterUserId ? "" : "active"
      }" type="button" data-filter-user="">
        <span class="social-avatar">✦</span>
        <span><strong>Tất cả</strong><small>${
          filteredMoments().length
        } bài</small></span>
      </button>
    `;

    list.innerHTML = allButton + owners.map(moment => `
      <button class="moment-friend ${
        state.momentFilterUserId === moment.user_id
          ? "active"
          : ""
      }" type="button" data-filter-user="${
        escapeHtml(moment.user_id)
      }">
        <span class="social-avatar">${
          escapeHtml(initials(moment.profile.username))
        }</span>
        <span>
          <strong>${escapeHtml(moment.profile.username)}</strong>
          <small>${escapeHtml(timeAgo(moment.created_at))}</small>
        </span>
      </button>
    `).join("");

    $$social("[data-filter-user]", list)
      .forEach(button => {
        button.addEventListener("click", async () => {
          state.momentFilterUserId =
            button.dataset.filterUser || null;

          state.activeMomentId =
            filteredMoments()[0]?.id || null;

          renderMomentFriendList();
          await renderActiveMoment();
        });
      });
  }

  function renderNoMoments() {
    setText("#activeMomentName", "Chưa có Khoảnh khắc");
    setText("#activeMomentTime", "Hãy đăng ảnh đầu tiên");
    setText("#momentLikeCount", "0");
    setText("#momentCommentCount", "0");
    setText("#momentFeedCount", "0");

    const avatar =
      $social(".moment-post-header .social-avatar");
    if (avatar) avatar.textContent = "NH";

    const grid = $social(".moment-photo-grid");
    if (grid) {
      grid.innerHTML =
        '<p class="social-empty social-empty-photo">Chưa có ảnh để hiển thị.</p>';
    }

    const caption = $social(".moment-caption");
    if (caption) caption.textContent = "";

    const comments = $social("#momentCommentList");
    if (comments) {
      comments.innerHTML =
        '<p class="social-empty">Chưa có bình luận.</p>';
    }

    setText(".moment-pagination strong", "0 / 0");
  }

  async function renderActiveMoment() {
    const list = filteredMoments();
    const moment = list.find(item =>
      item.id === state.activeMomentId
    ) || list[0];

    setText("#momentFeedCount", String(list.length));

    if (!moment) {
      state.activeMomentId = null;
      renderNoMoments();
      return;
    }

    state.activeMomentId = moment.id;
    setText("#activeMomentName", moment.profile.username);
    setText("#activeMomentTime", timeAgo(moment.created_at));

    const avatar =
      $social(".moment-post-header .social-avatar");
    if (avatar) {
      avatar.textContent = initials(moment.profile.username);
    }

    const imageUrl = await signedUrl(moment.image_path);
    const grid = $social(".moment-photo-grid");

    grid.innerHTML = `
      <img
        class="social-moment-image"
        src="${escapeHtml(imageUrl)}"
        alt="Khoảnh khắc của ${escapeHtml(moment.profile.username)}"
      >
    `;

    $social(".moment-caption").textContent =
      moment.caption || "";

    const pagination =
      $social(".moment-pagination strong");

    if (pagination) {
      pagination.textContent = `${
        list.indexOf(moment) + 1
      } / ${list.length}`;
    }

    await loadMomentDetails(moment.id);
  }

  async function loadMomentDetails(momentId) {
    const [likesResponse, commentsResponse] = await Promise.all([
      client
        .from("moment_likes")
        .select("user_id")
        .eq("moment_id", momentId),
      client
        .from("moment_comments")
        .select("id, user_id, body, created_at")
        .eq("moment_id", momentId)
        .order("created_at", { ascending: true })
    ]);

    if (likesResponse.error) throw likesResponse.error;
    if (commentsResponse.error) throw commentsResponse.error;

    const likes = likesResponse.data || [];
    const comments = commentsResponse.data || [];
    const commentUserIds = [...new Set(
      comments.map(comment => comment.user_id)
    )];

    let profiles = [];

    if (commentUserIds.length) {
      const response = await client
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", commentUserIds);

      if (response.error) throw response.error;
      profiles = response.data || [];
    }

    const profileMap = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    setText("#momentLikeCount", String(likes.length));
    setText("#momentCommentCount", String(comments.length));

    const liked = likes.some(like =>
      like.user_id === state.user.id
    );

    const likeButton = $social("#momentLikeButton");
    likeButton.classList.toggle("liked", liked);
    likeButton.setAttribute("aria-pressed", String(liked));

    const commentList = $social("#momentCommentList");

    commentList.innerHTML = comments.length
      ? comments.map(comment => {
          const profile = profileMap.get(comment.user_id) || {
            username: "Người dùng NoHa"
          };

          return `
            <article class="moment-comment">
              <span class="social-avatar">${
                escapeHtml(initials(profile.username))
              }</span>
              <div>
                <strong>${escapeHtml(profile.username)}</strong>
                <small>${escapeHtml(timeAgo(comment.created_at))}</small>
                <p>${escapeHtml(comment.body)}</p>
              </div>
            </article>
          `;
        }).join("")
      : '<p class="social-empty">Chưa có bình luận.</p>';
  }

  async function toggleMomentLike() {
    if (!state.activeMomentId) return;

    const button = $social("#momentLikeButton");
    const liked = button.getAttribute("aria-pressed") === "true";

    const query = liked
      ? client
          .from("moment_likes")
          .delete()
          .eq("moment_id", state.activeMomentId)
          .eq("user_id", state.user.id)
      : client
          .from("moment_likes")
          .insert({
            moment_id: state.activeMomentId,
            user_id: state.user.id
          });

    const { error } = await query;
    if (error) {
      showToast(explainError(error));
      return;
    }

    await loadMomentDetails(state.activeMomentId);
  }

  async function addMomentComment(event) {
    event.preventDefault();

    const input = $social("#momentCommentInput");
    const body = input.value.trim();

    if (!body || !state.activeMomentId) return;

    const { error } = await client
      .from("moment_comments")
      .insert({
        moment_id: state.activeMomentId,
        user_id: state.user.id,
        body
      });

    if (error) {
      showToast(explainError(error));
      return;
    }

    input.value = "";
    await loadMomentDetails(state.activeMomentId);
  }

  function moveMoment(direction) {
    const list = filteredMoments();
    if (!list.length) return;

    const current = Math.max(
      0,
      list.findIndex(moment =>
        moment.id === state.activeMomentId
      )
    );

    const next = (
      current + direction + list.length
    ) % list.length;

    state.activeMomentId = list[next].id;
    renderActiveMoment().catch(error =>
      showToast(explainError(error))
    );
  }

  function renderMessageFriends() {
    const recent = $social(".recent-friends");
    const conversations = $social(".conversation-list");

    if (recent) {
      recent.innerHTML = state.friends.length
        ? state.friends.slice(0, 6).map(friend => `
            <button type="button" data-message-friend="${
              escapeHtml(friend.id)
            }">
              <span class="social-avatar">${
                escapeHtml(initials(friend.username))
              }</span>
              <small>${escapeHtml(friend.username)}</small>
            </button>
          `).join("")
        : '<p class="social-empty">Hãy kết bạn để nhắn tin.</p>';
    }

    if (conversations) {
      conversations.innerHTML = state.friends.length
        ? state.friends.map(friend => `
            <button
              class="conversation-item ${
                state.activeFriendId === friend.id ? "active" : ""
              }"
              type="button"
              data-message-friend="${escapeHtml(friend.id)}"
            >
              <span class="conversation-thumb photo-thumb-pink">${
                escapeHtml(initials(friend.username))
              }</span>
              <span>
                <strong>${escapeHtml(friend.username)}</strong>
                <small>Mở cuộc trò chuyện</small>
              </span>
              <span><time>›</time></span>
            </button>
          `).join("")
        : '<p class="social-empty">Chưa có cuộc trò chuyện.</p>';
    }

    $$social("[data-message-friend]")
      .forEach(button => {
        button.addEventListener("click", () =>
          selectMessageFriend(button.dataset.messageFriend)
        );
      });
  }

  function renderMessagesEmpty() {
    setText("#activeChatName", "Chọn một người bạn");
    setText("#activeChatStatus", "Tin nhắn riêng tư trên NoHa");
    setText("#chatDetailName", "Chưa chọn cuộc trò chuyện");
    setText("#chatDetailStatus", "Hãy chọn bạn bè ở danh sách");

    const chatAvatar = $social(".chat-header .social-avatar");
    const detailAvatar = $social(".chat-profile .social-avatar");
    if (chatAvatar) chatAvatar.textContent = "NH";
    if (detailAvatar) detailAvatar.textContent = "NH";

    const list = $social("#chatMessageList");
    if (list) {
      list.innerHTML = `
        <div class="social-empty social-empty-with-action">
          <p>Chọn bạn bè để bắt đầu nhắn tin.</p>
          <button class="secondary-button open-profile-manager-button" type="button">
            Tìm và kết bạn
          </button>
        </div>
      `;
    }

    bindSocialEmptyActions();
  }

  function bindSocialEmptyActions() {
    $$social(".open-profile-manager-button")
      .forEach(button => {
        button.addEventListener("click", openProfile);
      });
  }

  async function selectMessageFriend(friendId) {
    state.activeFriendId = friendId;
    renderMessageFriends();

    const friend = state.friends.find(item =>
      item.id === friendId
    );

    setText("#activeChatName", friend?.username || "Bạn bè");
    setText("#activeChatStatus", "Bạn bè trên NoHa");
    setText("#chatDetailName", friend?.username || "Bạn bè");
    setText("#chatDetailStatus", "Tin nhắn riêng tư");

    const chatAvatar = $social(".chat-header .social-avatar");
    const detailAvatar = $social(".chat-profile .social-avatar");

    if (chatAvatar) chatAvatar.textContent = initials(friend?.username);
    if (detailAvatar) detailAvatar.textContent = initials(friend?.username);

    $social("#messagesScreen")
      ?.classList.add("chat-open");

    await loadMessages();
  }

  async function loadMessages() {
    if (!state.user || !state.activeFriendId) {
      renderMessagesEmpty();
      return;
    }

    const userId = state.user.id;
    const friendId = state.activeFriendId;

    const { data, error } = await client
      .from("direct_messages")
      .select(
        "id, sender_id, recipient_id, body, image_path, created_at, read_at"
      )
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${userId})`
      )
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) throw error;

    const messages = data || [];
    const imageEntries = await Promise.all(
      messages.map(async message => ({
        id: message.id,
        url: message.image_path
          ? await signedUrl(message.image_path)
          : ""
      }))
    );

    const imageMap = new Map(
      imageEntries.map(item => [item.id, item.url])
    );

    const list = $social("#chatMessageList");

    list.innerHTML = messages.length
      ? messages.map(message => {
          const sent = message.sender_id === userId;
          const image = imageMap.get(message.id);

          return `
            <div class="message-row ${sent ? "sent" : "received"}">
              ${sent ? "" : `<span class="social-avatar">${
                escapeHtml(initials(
                  state.friends.find(friend =>
                    friend.id === friendId
                  )?.username
                ))
              }</span>`}
              <div class="message-content">
                ${image ? `<img class="chat-message-image" src="${
                  escapeHtml(image)
                }" alt="Ảnh đã gửi">` : ""}
                ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
              </div>
              <time>${escapeHtml(timeAgo(message.created_at))}</time>
            </div>
          `;
        }).join("")
      : '<p class="social-empty">Chưa có tin nhắn. Hãy gửi lời chào!</p>';

    list.scrollTop = list.scrollHeight;

    const unreadIds = messages
      .filter(message =>
        message.recipient_id === userId &&
        !message.read_at
      )
      .map(message => message.id);

    if (unreadIds.length) {
      await client
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    }
  }

  function setPendingMessageSource(source) {
    if (state.pendingMessagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.pendingMessagePreviewUrl);
    }

    state.pendingMessageBlob =
      source instanceof Blob ? source : null;

    state.pendingMessagePreviewUrl = source instanceof Blob
      ? URL.createObjectURL(source)
      : source;

    const input = $social("#chatComposerInput");
    input.placeholder = "Ảnh đã đính kèm — thêm lời nhắn…";
    showToast("Đã đính kèm ảnh. Chọn bạn và bấm gửi.");
  }

  function clearPendingMessageSource() {
    if (state.pendingMessagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.pendingMessagePreviewUrl);
    }

    state.pendingMessageBlob = null;
    state.pendingMessagePreviewUrl = "";
    $social("#chatComposerInput").placeholder = "Nhắn tin...";
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!state.activeFriendId) {
      showToast("Hãy chọn một người bạn trước.");
      return;
    }

    const input = $social("#chatComposerInput");
    const body = input.value.trim();

    if (!body && !state.pendingMessagePreviewUrl) return;

    const submitButton =
      $social("#chatComposerForm > button[type='submit']");
    submitButton.disabled = true;

    try {
      let imagePath = null;

      if (state.pendingMessagePreviewUrl) {
        const blob = state.pendingMessageBlob ||
          await sourceToBlob(state.pendingMessagePreviewUrl);
        imagePath = await uploadBlob(blob, "messages");
      }

      const { error } = await client
        .from("direct_messages")
        .insert({
          sender_id: state.user.id,
          recipient_id: state.activeFriendId,
          body,
          image_path: imagePath
        });

      if (error) throw error;

      input.value = "";
      clearPendingMessageSource();
      await loadMessages();
    } catch (error) {
      showToast(explainError(error));
    } finally {
      submitButton.disabled = false;
    }
  }

  function scheduleRefresh(table) {
    clearTimeout(state.refreshTimer);

    state.refreshTimer = setTimeout(async () => {
      try {
        if (table === "friendships") {
          await loadFriends();
        } else if (table === "direct_messages") {
          await loadMessages();
        } else {
          await loadMoments();
        }
      } catch (error) {
        console.warn(error);
      }
    }, 250);
  }

  function subscribeRealtime() {
    if (!state.user) return;

    if (state.realtimeChannel) {
      client.removeChannel(state.realtimeChannel);
    }

    state.realtimeChannel = client
      .channel(`noha-social-${state.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => scheduleRefresh("friendships")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moments" },
        () => scheduleRefresh("moments")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moment_likes" },
        () => scheduleRefresh("moment_likes")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moment_comments" },
        () => scheduleRefresh("moment_comments")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => scheduleRefresh("direct_messages")
      )
      .subscribe();
  }

  async function loadSocialData() {
    if (!state.user) return;

    await loadProfile();
    await loadFriends();
    subscribeRealtime();
  }

  async function openSocialView(view) {
    if (!(await requireUser(`browse-${view}`))) return;

    try {
      await loadSocialData();
      openSocialScreen(view);

      if (view === "moments") {
        await loadMoments();
      } else {
        renderMessageFriends();

        if (!state.activeFriendId && state.friends[0]) {
          state.activeFriendId = state.friends[0].id;
        }

        if (state.activeFriendId) {
          await selectMessageFriend(state.activeFriendId);
        } else {
          renderMessagesEmpty();
        }
      }
    } catch (error) {
      showToast(explainError(error));
    }
  }

  async function completeShare(action) {
    if (!(await requireUser(action))) return;

    try {
      await loadSocialData();

      if (action === "profile") {
        await openProfile();
        return;
      }

      if (action === "private") {
        if (
          sharePreviewImage?.dataset.ready === "true"
        ) {
          setPendingMessageSource(sharePreviewImage.src);
        }

        await openSocialView("messages");
        return;
      }

      if (action === "moment") {
        if (
          sharePreviewImage?.dataset.ready === "true"
        ) {
          openMomentComposer(sharePreviewImage.src);
        } else {
          await openSocialView("moments");
        }
        return;
      }

      if (action === "browse-messages") {
        await openSocialView("messages");
        return;
      }

      await openSocialView("moments");
    } catch (error) {
      showToast(explainError(error));
    }
  }

  function bindSocialUi() {
    $$social("[data-app-view]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const view = button.dataset.appView;

          if (view === "capture") {
            openCaptureScreen();
          } else {
            openSocialView(view);
          }
        });
      });

    $social("#headerProfileButton")
      ?.addEventListener("click", openProfile);

    $social("#closeProfileButton")
      ?.addEventListener("click", () => profileDialog.close());

    $social("#profileForm")
      ?.addEventListener("submit", saveProfile);

    $social("#friendSearchForm")
      ?.addEventListener("submit", async event => {
        event.preventDefault();
        const query = $social("#friendSearchInput").value.trim();
        if (query.length < 2) return;

        try {
          await searchProfiles(query);
        } catch (error) {
          setProfileStatus(explainError(error), true);
        }
      });

    $social("#signOutButton")
      ?.addEventListener("click", signOut);

    $social("#momentComposerForm")
      ?.addEventListener("submit", publishMoment);

    [
      "#closeMomentComposerButton",
      "#cancelMomentComposerButton"
    ].forEach(selector => {
      $social(selector)?.addEventListener(
        "click",
        closeMomentComposer
      );
    });

    $social("#uploadMomentButton")
      ?.addEventListener("click", async () => {
        if (await requireUser("moment")) {
          $social("#momentUploadInput").click();
        }
      });

    $social("#momentUploadInput")
      ?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) openMomentComposer(file);
        event.target.value = "";
      });

    $social("#momentLikeButton")
      ?.addEventListener("click", toggleMomentLike);

    $social("#focusCommentButton")
      ?.addEventListener("click", () =>
        $social("#momentCommentInput")?.focus()
      );

    $social("#momentCommentForm")
      ?.addEventListener("submit", addMomentComment);

    $$social("[data-moment-scope]")
      .forEach(button => {
        button.addEventListener("click", async () => {
          state.momentScope = button.dataset.momentScope;
          state.momentFilterUserId = null;
          state.activeMomentId = filteredMoments()[0]?.id || null;

          syncMomentScopeTabs();

          renderMomentFriendList();
          await renderActiveMoment();
        });
      });

    $social("#momentFriendSearch")
      ?.addEventListener("input", event => {
        const query = event.target.value
          .trim()
          .toLocaleLowerCase("vi");

        $$social(".moment-friend", $social(".moment-friend-list"))
          .forEach(item => {
            item.hidden = Boolean(query) &&
              !item.textContent
                .toLocaleLowerCase("vi")
                .includes(query);
          });
      });

    const arrows = $$social(".moment-arrow");
    arrows[0]?.addEventListener("click", () => moveMoment(-1));
    arrows[1]?.addEventListener("click", () => moveMoment(1));

    $social("#shareMomentButton")
      ?.addEventListener("click", async () => {
        const moment = state.moments.find(item =>
          item.id === state.activeMomentId
        );

        if (moment) {
          setPendingMessageSource(
            await signedUrl(moment.image_path)
          );
          await openSocialView("messages");
        }
      });

    $social("#conversationSearch")
      ?.addEventListener("input", event => {
        const query = event.target.value
          .trim()
          .toLocaleLowerCase("vi");

        $$social(".conversation-item")
          .forEach(item => {
            item.hidden = Boolean(query) &&
              !item.textContent
                .toLocaleLowerCase("vi")
                .includes(query);
          });
      });

    $social("#chatComposerForm")
      ?.addEventListener("submit", sendMessage);

    $social("#attachPhotoboothButton")
      ?.addEventListener("click", () => {
        if (sharePreviewImage?.dataset.ready === "true") {
          setPendingMessageSource(sharePreviewImage.src);
        } else {
          showToast("Hãy chụp một bộ ảnh trước.");
        }
      });

    $social("#attachImageButton")
      ?.addEventListener("click", () =>
        $social("#chatFileInput").click()
      );

    $social("#chatFileInput")
      ?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) setPendingMessageSource(file);
        event.target.value = "";
      });

    $social("#mobileChatBackButton")
      ?.addEventListener("click", () => {
        $social("#messagesScreen")
          ?.classList.remove("chat-open");
      });
  }

  async function initialize() {
    bindSocialUi();
    renderFriendSurfaces();
    renderNoMoments();
    renderMessagesEmpty();

    try {
      await refreshSession();

      if (state.user) {
        await loadSocialData();
      }
    } catch (error) {
      console.warn(error);
    }

    client.auth.onAuthStateChange((event, session) => {
      state.user = session?.user || null;

      if (event === "SIGNED_OUT") {
        clearPrivateState();
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
        setTimeout(() => {
          loadSocialData().catch(error =>
            console.warn(error)
          );
        }, 0);
      }
    });
  }

  window.nohaSocialApp = {
    completeShare,
    openProfile,
    refresh: loadSocialData
  };

  initialize();
})();
