// عميل Supabase المشترك — تستخدمه كل الصفحات
const SUPABASE_URL = "https://iqhmgefdshmeozcdtrah.supabase.co";
const SUPABASE_KEY = "sb_publishable_YS9o0VEh-K5smzRSioA8kQ_AqYH2YLj";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
