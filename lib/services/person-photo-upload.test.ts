/**
 * Run: npx --yes tsx lib/services/person-photo-upload.test.ts
 */
import assert from 'node:assert/strict';
import { isAllowedPersonPhoto, parsePortalPhotoForm } from './person-photo-upload';

assert.equal(
  isAllowedPersonPhoto({ name: 'jared.jpg', type: 'image/jpeg', size: 1200 }),
  null
);
assert.equal(
  isAllowedPersonPhoto({ name: 'shot.PNG', type: 'image/png', size: 800 }),
  null
);
assert.match(
  String(isAllowedPersonPhoto({ name: 'cv.pdf', type: 'application/pdf' })),
  /image/i
);
assert.match(
  String(
    isAllowedPersonPhoto({
      name: 'huge.jpg',
      type: 'image/jpeg',
      size: 9 * 1024 * 1024,
    })
  ),
  /8MB/
);

{
  const form = new FormData();
  form.set('token', 'member-token-1');
  form.set('action', 'upload_photo');
  form.set('file', new File(['x'], 'me.jpg', { type: 'image/jpeg' }));
  const parsed = parsePortalPhotoForm(form);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.token, 'member-token-1');
    assert.equal(parsed.file.name, 'me.jpg');
  }
}

{
  const form = new FormData();
  form.set('token', 'member-token-1');
  form.set('action', 'book');
  const parsed = parsePortalPhotoForm(form);
  assert.equal(parsed.ok, false);
}

console.log('person-photo-upload.test.ts ok');
