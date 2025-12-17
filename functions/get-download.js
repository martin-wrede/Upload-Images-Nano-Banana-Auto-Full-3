// functions/get-download.js
// Worker to return the latest generated download HTML page for a given email

export async function onRequestGet({ request, env }) {
    try {
        const url = new URL(request.url);
        const email = url.searchParams.get('email');

        if (!email) {
            return new Response('<h1>Missing email</h1><p>Please provide ?email=you@example.com</p>', {
                status: 400,
                headers: { 'Content-Type': 'text/html' }
            });
        }

        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        const prefix = `${safeEmail}_gen/`;

        // List objects in the user's generated folder
        const listed = await env.IMAGE_BUCKET.list({ prefix, limit: 1000 });
        if (!listed || !listed.objects || listed.objects.length === 0) {
            return new Response(`<h1>No download page found</h1><p>No generated download pages found for email ${email}</p>`, {
                status: 404,
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Pick the latest download_*.html by timestamp in filename if present, otherwise fallback to newest object
        const downloads = listed.objects.filter(o => /download_\d+\.html$/.test(o.key));
        let chosenKey = null;

        if (downloads.length > 0) {
            downloads.sort((a, b) => {
                const ta = parseInt((a.key.match(/download_(\d+)\.html$/) || [])[1] || '0', 10);
                const tb = parseInt((b.key.match(/download_(\d+)\.html$/) || [])[1] || '0', 10);
                return tb - ta; // descending
            });
            chosenKey = downloads[0].key;
        } else {
            // fallback: take the most recently uploaded by uploaded timestamp if available
            listed.objects.sort((a, b) => {
                const ta = a.uploaded ? new Date(a.uploaded).getTime() : 0;
                const tb = b.uploaded ? new Date(b.uploaded).getTime() : 0;
                return tb - ta;
            });
            chosenKey = listed.objects[0].key;
        }

        if (!chosenKey) {
            return new Response(`<h1>No download page found</h1><p>No suitable download HTML found for email ${email}</p>`, {
                status: 404,
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // If R2 public URL is provided, redirect there (preserves original static HTML and assets)
        if (env.R2_PUBLIC_URL) {
            const redirectUrl = `${env.R2_PUBLIC_URL}/${chosenKey}`;
            return Response.redirect(redirectUrl, 302);
        }

        // Otherwise, fetch the object from R2 and return its HTML content
        const object = await env.IMAGE_BUCKET.get(chosenKey);
        if (!object) {
            return new Response(`<h1>Not found</h1><p>Could not retrieve ${chosenKey}</p>`, { status: 404, headers: { 'Content-Type': 'text/html' } });
        }

        // Return the object's body directly (should be HTML)
        return new Response(object.body, {
            status: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache'
            }
        });

    } catch (err) {
        console.error('Error in get-download:', err);
        return new Response(`<h1>Server Error</h1><pre>${err.message}</pre>`, { status: 500, headers: { 'Content-Type': 'text/html' } });
    }
}
