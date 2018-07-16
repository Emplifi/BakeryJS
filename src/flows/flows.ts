export default {
	all: {
		process: [
			[
				{
					tick: [['print']],
				},
			],
		],
	},
	process2: {
		process: [
			[
				{
					s1_p1: [
						['s1_p1_s1_p1', 's1_p1_s1_p2', 's1_p1_s1_p3'],
						['s1_p1_s2'],
						[
							{
								s1_p1_s3_p1: [
									['s1_p1_s3_p1_s1'],
									['s1_p1_s3_p1_s2'],
								],
							},
							's1_p1_s3_p2',
							's1_p1_s3_p3',
						],
						[
							's1_p1_s4_p1',
							's1_p1_s4_p2',
							's1_p1_s4_p3',
							's1_p1_s4_p4',
							's1_p1_s4_p5',
							's1_p1_s4_p6',
							's1_p1_s4_p7',
						],
						['s1_p1_s5_p1', 's1_p1_s5_p2'],
						['s1_p1_s6_p1'],
						['s1_p1_s7_p1', 's1_p1_s7_p2'],
					],
					s1_p2: [['s1_p2_s1']],
				},
			],
			['s2'],
			['s3_p1', 's3_p2'],
			['s4_p1', 's4_p2'],
		],
	},
	process3: {
		process: [
			[
				{
					fb_grab_feed: [
						['fb_post_to_mbf', 'fans', 'read_post_metaindex'],
						['compare_etag'],
						[
							{
								fb_grab_commments: [
									['fb_comment_to_mbf'],
									['fb_comment_save'],
								],
							},
							'fb_grab_video',
							'fb_grab_album',
						],
						[
							'fb_save_video',
							'fb_save_album',
							'calculate_response_time',
							'ppd',
							'acat',
							'bttp',
							'interaction_per_1k_fans',
						],
						['compare_builder_etag', 'compare_content_api_etag'],
						['write_post_metaindex'],
						['put_to_content_api', 'push_to_community'],
					],
					fb_grab_profile_insights: [['save_profile_insights']],
				},
			],
			['fb_profile_to_mbf'],
			['fb_save_profile', 'fb_save_profile_to_s3'],
			['call_remote_api', 'schedule_next_run'],
		],
	},
};
