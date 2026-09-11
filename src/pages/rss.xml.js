import rss from '@astrojs/rss';
import {getSortedPosts} from '../utils/content-utils';
export async function GET(context) {
return rss({title:'Seek',description:'中文个人博客',site:context.site,items:(await getSortedPosts()).map(p=>({title:p.data.title,description:p.data.description,pubDate:p.data.published,link:'/posts/'+p.slug+'/'}))});
}
