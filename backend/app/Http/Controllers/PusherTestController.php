<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pusher\Pusher;

class PusherTestController extends Controller
{
    public function trigger(Request $request): JsonResponse
    {
        $pusher = new Pusher(
            (string) env('PUSHER_APP_KEY'),
            (string) env('PUSHER_APP_SECRET'),
            (string) env('PUSHER_APP_ID'),
            [
                'cluster' => env('PUSHER_APP_CLUSTER', 'mt1'),
                'useTLS' => (bool) env('PUSHER_USE_TLS', true),
            ]
        );

        $data = $request->input('data', ['message' => 'hello world']);

        $pusher->trigger('my-channel', 'my-event', $data);

        return response()->json(['status' => 'event sent']);
    }
}
