(() => {
  const { CMS, h } = window;
  const settingsMode = new URLSearchParams(location.search).get('editor') === 'settings';
  const dataOf = entry => entry.get('data');
  const asset = (props, value) => {
    if (!value) return '';
    const legacy = {'assets/images/demo-avatar.png':'/uploads/site-avatar.png','assets/images/demo-banner.png':'/uploads/site-banner.png'};
    const path = legacy[value] || value;
    return String(props.getAsset(path) || path);
  };
  CMS.registerPreviewStyle('/admin/preview.css');
  CMS.registerPreviewTemplate('site', props => {
    const d = dataOf(props.entry);
    return h('div', {className:'site-preview'},
      h('div', {className:'preview-note'}, '实时预览 · 保存前即可查看效果，线上更新需等待部署完成'),
      h('nav', {className:'preview-nav'}, d.get('name') || '显示名称', h('span',{},'主页　归档　关于')),
      h('img', {className:'preview-banner',src:asset(props,d.get('banner')),alt:'主页横幅',style:{objectPosition:d.get('bannerPosition') || 'center'}}),
      h('div',{className:'preview-grid'},
        h('aside',{className:'preview-profile'},
          h('img',{src:asset(props,d.get('avatar')),alt:'头像'}),
          h('h2',{},d.get('name')),h('p',{},d.get('bio')),h('span',{className:'github-pill'},'GitHub')),
        h('section',{className:'preview-card'},h('h1',{},d.get('name')),h('p',{},d.get('subtitle')),h('hr'),h('h3',{},'文章列表'),h('p',{},'这里展示主页排版。文章内容不会因修改网站设置而改变。'))));
  });
  CMS.registerPreviewTemplate('blog', props => {
    const d=dataOf(props.entry);
    return h('article',{className:'post-preview'},h('h1',{},d.get('title')),h('p',{className:'preview-note'},[d.get('published'),d.get('category')].filter(Boolean).join(' · ')),d.get('image') ? h('img',{className:'post-cover',src:asset(props,d.get('image')),alt:'文章封面'}) : null,h('p',{},d.get('description')),props.widgetFor('body'));
  });
  let timer;
  function status(text) { document.getElementById('save-status').textContent=text; }
  async function trackDeployment(expected) {
    clearTimeout(timer);
    status('已保存到仓库，正在等待网站部署。请勿重复点击保存。');
    const started=Date.now();
    async function check() {
      try {
        const response=await fetch('/site-state.json?t='+Date.now(),{cache:'no-store'});
        if (response.ok) {
          const current=await response.json();
          if (Object.keys(expected).every(key=>JSON.stringify(current[key])===JSON.stringify(expected[key]))) {
            status('已保存，线上主页已同步更新。');
            sessionStorage.removeItem('seek_pending_site');
            return;
          }
        }
      } catch {}
      if (Date.now()-started>10*60*1000) { status('已保存到仓库，但尚未确认上线。请稍后重新打开此页检查；无需重复保存。'); return; }
      timer=setTimeout(check,10000);
    }
    check();
  }
  CMS.registerEventListener({name:'preSave',handler:({entry})=> {
    let data=dataOf(entry);
    if (entry.get('collection')==='settings') {
      for (const key of ['avatar','banner']) {
        let value=String(data.get(key)||'').trim();
        if (value.startsWith('public/')) value=value.slice(6);
        if (value.startsWith('uploads/')) value='/'+value;
        if (!/^\/uploads\//.test(value) && !/^https:\/\//.test(value)) throw new Error('请从媒体库选择'+(key==='avatar'?'头像':'横幅')+'，或填写 HTTPS 图片地址。');
        data=data.set(key,value);
      }
    }
    return data;
  }});
  CMS.registerEventListener({name:'postSave',handler:({entry})=> {
    if (entry.get('collection')==='settings') {
      const saved=dataOf(entry).toJS();sessionStorage.setItem('seek_pending_site',JSON.stringify(saved));trackDeployment(saved);
    } else status('文章草稿已保存。需要上线时，请使用“发布”；勾选“草稿”会隐藏文章。');
  }});
  CMS.registerEventListener({name:'postPublish',handler:()=>status('已发布到仓库，网站正在自动部署；部署完成后主页才会更新。')});
  const settings = {
    name:'settings',label:'网站设置',delete:false,description:'修改后点击保存，直接更新网站设置。右侧为实时效果；下方显示线上同步状态。',
    files:[{name:'site',label:'主页资料',file:'src/site.json',format:'json',fields:[
      {label:'显示名称',name:'name',widget:'string'},
      {label:'网站副标题',name:'subtitle',widget:'string'},
      {label:'个人简介',name:'bio',widget:'text'},
      {label:'头像',name:'avatar',widget:'image',hint:'建议正方形。从媒体库选择，选好后右侧立即预览。'},
      {label:'主页横幅',name:'banner',widget:'image',hint:'建议横向图片。右侧展示裁切效果，位置可在下方调整。'},
      {label:'横幅显示位置',name:'bannerPosition',widget:'select',default:'center',options:[{label:'顶部',value:'top'},{label:'居中',value:'center'},{label:'底部',value:'bottom'}]}
    ]}]
  };
  CMS.init({config: settingsMode ? {site_url:'https://785000.xyz',display_url:'https://785000.xyz',media_folder:'public/uploads',public_folder:'/uploads',publish_mode:'simple',backend:{name:'github',repo:'jjwang54188/seek-gpt',branch:'master',base_url:'https://seek-gpt.pages.dev',auth_endpoint:'/api/auth',commit_messages:{update:'更新网站设置：{{slug}}',uploadMedia:'上传图片：{{path}}'}},collections:[settings]} : {}});
  status(settingsMode ? '网站设置：保存后自动部署，无需切换审核或发布状态。' : '文章：保存为草稿，再发布上线；勾选“草稿”会使文章不显示在主页。');
  if(settingsMode) { try { const pending=JSON.parse(sessionStorage.getItem('seek_pending_site'));if(pending)trackDeployment(pending); }catch{} }
})();
