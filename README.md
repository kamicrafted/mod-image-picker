# image-picker

When Claude makes several images for you to choose from, this mod shows them side by side right in your Claude Code session. Click **Pick 2** (or press 2), and Claude gets your choice as your next message. You don't need to open Preview or switch apps.

## Install it

**You install this yourself, not Claude.** If you ask Claude to install it, it will stop and ask you to do it. That's on purpose: a mod changes how Claude works in every future session, so Claude leaves that decision to you.

Pick the way that matches how you use Claude.

### In the Claude Code terminal (the usual way)

1. Type this at the Claude Code prompt and press Enter:

   ```
   /plugin install image-picker --marketplace kamicrafted/mod-image-picker
   ```

2. When it asks whether to add the marketplace, type `y`.
3. When it asks where to install, press Enter to keep the default.

### In the Claude desktop app

The `/plugin` command doesn't work in the desktop app. Use the menus instead:

1. Click **+** next to the box where you type.
2. Click **Plugins**, then **Add marketplace**, and paste `kamicrafted/mod-image-picker`.
3. Click **Add plugin**.

### From your own terminal

If you'd rather run a command outside Claude, open the Terminal app and paste this:

```
claude plugin install image-picker --marketplace kamicrafted/mod-image-picker
```

Claude can't run this line for you. If Claude offers to, type it at the Claude prompt with a `!` in front instead. The `!` runs the command as you, not as Claude:

```
! claude plugin install image-picker --marketplace kamicrafted/mod-image-picker
```

## Get updates automatically

Claude Code doesn't update this mod on its own unless you turn that on. You only need to do this once:

1. Type `/plugin` at the Claude Code prompt and press Enter.
2. Go to **Marketplaces** and choose `mod-image-picker`.
3. Choose **Enable auto-update**.

New versions then arrive when you start a new session. To update right away instead, open `/plugin`, go to **Installed**, choose image-picker, and choose **Update now**.

## What it does

Whenever Claude makes 2 to 9 images, it shows them to you as a grid. You can also ask for the grid yourself, for example "show me these four and let me pick."

- Up to 4 images show 2 across. 5 or more show 3 across.
- Under the grid there's a **None of these** button. You can also type the number of the one you want.
- The grid uses small copies of your images. Your original files stay as they are.

The mod also stops Claude from opening a pile of images in separate windows at once, and shows them in the grid instead. Opening a single image still works.

To make the small copies, the mod uses an image tool your computer already has. Every Mac has one built in (`sips`), so most people don't need to install anything. On other computers it looks for ImageMagick, libvips or ffmpeg.

## Where you'll see real images

What you see depends on the app you run Claude in.

| App | What you see |
| --- | --- |
| Ghostty or kitty | The images themselves |
| iTerm2 (version 3.5 or later) | The images themselves, in Claude Code's fullscreen mode |
| Claude desktop app, VS Code | Small images in the app's side panel |
| tmux (version 3.3 or later) | The images themselves, after the setup below |
| Any other terminal | A numbered list of file names, with the same Pick buttons |

### tmux setup

If you don't know what tmux is, you can skip this. If you use it, add these two lines to the file `~/.tmux.conf`:

```
set -g allow-passthrough on
set -g focus-events on
```

## License

MIT
