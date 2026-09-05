# 博客后台接通说明

后台地址是 `https://785000.xyz/admin/`。它会把你在后台保存的文章直接提交到 GitHub，然后 Cloudflare Pages 自动重新发布网站。

## 第一次接通

这一步只需要做一次，且不要把任何密钥发到聊天窗口。

1. 登录 GitHub，打开 https://github.com/settings/developers ，选择 **OAuth Apps**，再选择 **New OAuth App**。
2. 依次填写：
   - Application name：`Seek 博客后台`
   - Homepage URL：`https://785000.xyz/admin/`
   - Authorization callback URL：`https://785000.xyz/api/callback`
   - Add a second redirect URI：`https://seek-gpt.pages.dev/api/callback`
3. 点击 **Register application**。复制页面上的 **Client ID**；再点 **Generate a new client secret**，立即复制 **Client secret**。这个 secret 只显示一次。
4. 登录 Cloudflare，进入 **Workers & Pages** -> **seek-gpt** -> **Settings** -> **Variables and Secrets**。
5. 在 **Production** 环境中添加两条变量，类型都选 **Secret**：
   - `GITHUB_CLIENT_ID`：粘贴 GitHub 的 Client ID。
   - `GITHUB_CLIENT_SECRET`：粘贴 GitHub 的 Client secret。
6. 保存后，Cloudflare 会重新部署网站。部署完成后，访问 `https://785000.xyz/admin/`，选择 **Login with GitHub** 并授权。

## 日常发文章

1. 打开 `https://785000.xyz/admin/` 并登录。
2. 点击 **文章**，再点 **新建文章**。
3. 填写标题、摘要、发布日期和正文；封面图不是必填项。
4. 点击右上角的保存并发布。大约一两分钟后，文章会出现在网站上。

保存文章会在 GitHub 仓库中新增或修改文件；删除文章会删除对应文件。后台只应由你自己的 GitHub 账号登录。
