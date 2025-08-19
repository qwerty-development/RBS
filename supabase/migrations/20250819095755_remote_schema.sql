revoke select on table "auth"."schema_migrations" from "postgres";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_auth_user_login AFTER UPDATE ON auth.users FOR EACH ROW WHEN ((old.last_sign_in_at IS DISTINCT FROM new.last_sign_in_at)) EXECUTE FUNCTION update_staff_last_login();


grant delete on table "storage"."s3_multipart_uploads" to "postgres";

grant insert on table "storage"."s3_multipart_uploads" to "postgres";

grant references on table "storage"."s3_multipart_uploads" to "postgres";

grant select on table "storage"."s3_multipart_uploads" to "postgres";

grant trigger on table "storage"."s3_multipart_uploads" to "postgres";

grant truncate on table "storage"."s3_multipart_uploads" to "postgres";

grant update on table "storage"."s3_multipart_uploads" to "postgres";

grant delete on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant insert on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant references on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant select on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant trigger on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant truncate on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant update on table "storage"."s3_multipart_uploads_parts" to "postgres";

create policy "changes 1ffg0oo_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'images'::text));


create policy "changes 1ffg0oo_1"
on "storage"."objects"
as permissive
for insert
to public
with check ((bucket_id = 'images'::text));


create policy "changes 1ffg0oo_2"
on "storage"."objects"
as permissive
for update
to public
using ((bucket_id = 'images'::text));


create policy "changes 1ffg0oo_3"
on "storage"."objects"
as permissive
for delete
to public
using ((bucket_id = 'images'::text));


create policy "changes 1oj01fe_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'avatars'::text));


create policy "changes 1oj01fe_1"
on "storage"."objects"
as permissive
for insert
to public
with check ((bucket_id = 'avatars'::text));


create policy "changes 1oj01fe_2"
on "storage"."objects"
as permissive
for update
to public
using ((bucket_id = 'avatars'::text));


create policy "changes 1oj01fe_3"
on "storage"."objects"
as permissive
for delete
to public
using ((bucket_id = 'avatars'::text));


create policy "changes 1tsy3yu_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'review-photos'::text));


create policy "changes 1tsy3yu_1"
on "storage"."objects"
as permissive
for insert
to public
with check ((bucket_id = 'review-photos'::text));


create policy "changes 1tsy3yu_2"
on "storage"."objects"
as permissive
for update
to public
using ((bucket_id = 'review-photos'::text));


create policy "changes 1tsy3yu_3"
on "storage"."objects"
as permissive
for delete
to public
using ((bucket_id = 'review-photos'::text));


create policy "fixed l38788_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'restaurant-logos'::text));


create policy "fixed l38788_1"
on "storage"."objects"
as permissive
for insert
to public
with check ((bucket_id = 'restaurant-logos'::text));


create policy "fixed l38788_2"
on "storage"."objects"
as permissive
for update
to public
using ((bucket_id = 'restaurant-logos'::text));


create policy "fixed l38788_3"
on "storage"."objects"
as permissive
for delete
to public
using ((bucket_id = 'restaurant-logos'::text));


create policy "test 1cw6wbv_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'special-offers'::text));


create policy "test 1cw6wbv_1"
on "storage"."objects"
as permissive
for insert
to public
with check ((bucket_id = 'special-offers'::text));


create policy "test 1cw6wbv_2"
on "storage"."objects"
as permissive
for update
to public
using ((bucket_id = 'special-offers'::text));


create policy "test 1cw6wbv_3"
on "storage"."objects"
as permissive
for delete
to public
using ((bucket_id = 'special-offers'::text));



