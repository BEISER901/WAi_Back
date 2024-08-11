module.exports = {

    // user to chat with selector. We will "click" this selector so that chat window of
    // specified user is opened. XXX will be replaced by actual user.
    user_chat: '*[title="XXX"]',

    // search box to find users
    search_box: '#side [contenteditable]',

    // textbox selector where message will be typed
    chat_input: '#main [data-testid="conversation-compose-box-input"]',

    // used to read last message sent by other person
    last_message: '#main div.message-in',

    // last message sent by you
    last_message_sent: '#main div.message-out span.selectable-text:last-child',

    // used to check if your messsage was read
    last_message_read: '#main div.message-out span[data-icon]:last-child',

    // gets username for conversation thread
    user_name: '#main header [aria-label]',

    // checks if there are new messages by any users

    new_message: '#pane-side span.XXXXX',
    new_message_user: 'span[title]',
    new_message_count: "#pane-side span",
    new_message_user_pic_url: '#pane-side img[src^="https://web.whatsapp.com/pp"]',

    scroll_top: '.x14m1o6m.x126m2zf.x1b9z3ur.x9f619.x1rg5ohu.x1okw0bk.x193iq5w.x123j3cw.xn6708d.x10b6aqq.x1ye3gou.x13a8xbf.xdod15v.x2b8uid.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c',

    chat_messages: '#main div.message-out,#main div.message-in',
    date_message: '[data-pre-plain-text]',
    text_message: '[dir="ltr"]'
}